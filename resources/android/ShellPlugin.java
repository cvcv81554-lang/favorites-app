package __PKG__;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.util.ArrayList;
import android.util.Base64;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * كشف Android TV، إخفاء المحتوى من قائمة التطبيقات الأخيرة (FLAG_SECURE)،
 * وخادم HTTP صغير على الشبكة المحلية يستقبل المزامنة من تطبيق الجوال:
 *   PUT /photo/<name>?k=CODE  جسم الطلب base64 ← يُكتب ملف الصورة مباشرة (بلا مرور على JavaScript)
 *   أي طلب آخر ← يُمرَّر لـ JavaScript (حدث "request") وينتظر الرد عبر respond().
 */
@CapacitorPlugin(name = "Shell")
public class ShellPlugin extends Plugin {
    private static final int MAX_BODY = 96 * 1024 * 1024;
    private ServerSocket server;
    private volatile String token = "";
    private volatile File photoDir;
    private int port = 0;
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final Map<String, Integer> fails = new ConcurrentHashMap<>();
    // حماية الاستقبال: حد للاتصالات المتزامنة، وحد عام للمحاولات الخاطئة (30 خلال 10 دقائق → قفل 10 دقائق)
    private final java.util.concurrent.Semaphore slots = new java.util.concurrent.Semaphore(8);
    private final java.util.concurrent.atomic.AtomicInteger gFails = new java.util.concurrent.atomic.AtomicInteger();
    private volatile long gStart = 0, lockUntil = 0;

    private static class Pending {
        final CountDownLatch latch = new CountDownLatch(1);
        volatile int status = 504;
        volatile String body = "{\"error\":\"timeout\"}";
    }

    @PluginMethod
    public void info(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        boolean tv = pm.hasSystemFeature("android.software.leanback") || pm.hasSystemFeature("android.hardware.type.television") || !pm.hasSystemFeature("android.hardware.touchscreen");
        JSObject ret = new JSObject();
        ret.put("tv", tv);
        ret.put("sdk", android.os.Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    @PluginMethod
    public void secure(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    // ---------------- البحث الصوتي (ريموت التلفاز) ----------------
    @PluginMethod
    public void voice(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "ar-SA"));
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", ""));
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(call, i, "voiceResult");
        } catch (Exception e) {
            call.reject("unavailable");
        }
    }

    @ActivityCallback
    private void voiceResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        String text = "";
        Intent data = result.getData();
        if (data != null) {
            ArrayList<String> l = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (l != null && !l.isEmpty() && l.get(0) != null) text = l.get(0);
        }
        ret.put("text", text);
        call.resolve(ret);
    }

    // ---------------- خادم المزامنة ----------------
    @PluginMethod
    public void startServer(PluginCall call) {
        token = call.getString("token", "");
        String dir = call.getString("photoDir", "");
        if (dir.startsWith("file://")) dir = dir.substring(7);
        photoDir = new File(dir);
        if (!photoDir.exists()) photoDir.mkdirs();
        try {
            if (server == null || server.isClosed()) {
                int base = call.getInt("port", 8765);
                IllegalStateException last = null;
                for (int p = base; p < base + 6; p++) {
                    try {
                        ServerSocket s = new ServerSocket();
                        s.setReuseAddress(true);
                        s.bind(new InetSocketAddress(p));
                        server = s; port = p; last = null; break;
                    } catch (Exception e) { last = new IllegalStateException(e.getMessage()); }
                }
                if (server == null) throw last != null ? last : new IllegalStateException("bind");
                final ServerSocket srv = server;
                Thread t = new Thread(() -> loop(srv), "fav-sync");
                t.setDaemon(true);
                t.start();
            }
            JSObject ret = new JSObject();
            ret.put("ip", localIp());
            ret.put("port", port);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setToken(PluginCall call) { token = call.getString("token", ""); fails.clear(); call.resolve(); }

    @PluginMethod
    public void address(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ip", localIp());
        ret.put("port", port);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        server = null;
        call.resolve();
    }

    @PluginMethod
    public void respond(PluginCall call) {
        Pending p = pending.get(call.getString("id", ""));
        if (p != null) {
            p.status = call.getInt("status", 200);
            p.body = call.getString("body", "{}");
            p.latch.countDown();
        }
        call.resolve();
    }

    private void loop(ServerSocket srv) {
        while (!srv.isClosed()) {
            try {
                final Socket s = srv.accept();
                if (!slots.tryAcquire()) { try { s.close(); } catch (Exception ignored) {} continue; }
                Thread t = new Thread(() -> { try { handle(s); } finally { slots.release(); } }, "fav-sync-req");
                t.setDaemon(true);
                t.start();
            } catch (Exception e) {
                if (srv.isClosed()) return;
            }
        }
    }

    private static String readLine(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 16384) throw new IllegalStateException("header too long");
        }
        if (c == -1 && b.size() == 0) return null;
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    private static String param(String query, String key) {
        if (query == null) return "";
        for (String kv : query.split("&")) {
            int i = kv.indexOf('=');
            String k = i < 0 ? kv : kv.substring(0, i);
            if (k.equals(key)) {
                try { return java.net.URLDecoder.decode(i < 0 ? "" : kv.substring(i + 1), "UTF-8"); } catch (Exception e) { return ""; }
            }
        }
        return "";
    }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(90000);
            InputStream in = new java.io.BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();
            String line = readLine(in);
            if (line == null) { s.close(); return; }
            String[] parts = line.split(" ");
            if (parts.length < 2) { s.close(); return; }
            String method = parts[0].toUpperCase();
            String target = parts[1];
            int len = 0;
            String h;
            while ((h = readLine(in)) != null && h.length() > 0) {
                int i = h.indexOf(':');
                if (i > 0 && h.substring(0, i).trim().equalsIgnoreCase("content-length")) len = Integer.parseInt(h.substring(i + 1).trim());
            }
            if (method.equals("OPTIONS")) { reply(out, 204, ""); s.close(); return; }
            int q = target.indexOf('?');
            String path = q < 0 ? target : target.substring(0, q);
            String query = q < 0 ? "" : target.substring(q + 1);
            String peer = s.getInetAddress().getHostAddress();
            // التحقق من الرمز قبل قراءة أي جسم (لا ذاكرة تُحجز لطلب غير مصرّح)
            long now = System.currentTimeMillis();
            if (now - gStart > 600000) { gStart = now; gFails.set(0); fails.clear(); }
            Integer f = fails.get(peer);
            if (now < lockUntil || (f != null && f >= 12)) { reply(out, 429, "{\"error\":\"locked\"}"); s.close(); return; }
            byte[] want = token.getBytes(StandardCharsets.UTF_8), got = param(query, "k").getBytes(StandardCharsets.UTF_8);
            if (want.length == 0 || !java.security.MessageDigest.isEqual(want, got)) {
                fails.put(peer, (f == null ? 0 : f) + 1);
                if (gFails.incrementAndGet() >= 30) { lockUntil = now + 600000; gFails.set(0); }
                reply(out, 401, "{\"error\":\"code\"}");
                s.close();
                return;
            }
            fails.remove(peer);
            if (len < 0 || len > MAX_BODY) { reply(out, 413, "{\"error\":\"too large\"}"); s.close(); return; }
            byte[] body = new byte[len];
            int off = 0;
            while (off < len) { int r = in.read(body, off, len - off); if (r < 0) break; off += r; }
            if (path.startsWith("/photo/") && (method.equals("PUT") || method.equals("POST"))) {
                String name = path.substring(7);
                if (!name.matches("[A-Za-z0-9_-]{1,80}\\.(jpg|jpeg|png|webp|gif|avif)")) { reply(out, 400, "{\"error\":\"name\"}"); s.close(); return; }
                byte[] data = Base64.decode(new String(body, 0, off, StandardCharsets.US_ASCII), Base64.DEFAULT);
                File dst = new File(photoDir, name), tmp = new File(photoDir, name + ".part");
                try (FileOutputStream fo = new FileOutputStream(tmp)) { fo.write(data); }
                if (!tmp.renameTo(dst)) { dst.delete(); tmp.renameTo(dst); }
                reply(out, 200, "{\"ok\":true,\"size\":" + data.length + "}");
                s.close();
                return;
            }
            String id = UUID.randomUUID().toString();
            Pending p = new Pending();
            pending.put(id, p);
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("method", method);
            ev.put("path", path);
            ev.put("query", query);
            ev.put("body", new String(body, 0, off, StandardCharsets.UTF_8));
            notifyListeners("request", ev);
            p.latch.await(100, TimeUnit.SECONDS);
            pending.remove(id);
            reply(out, p.status, p.body);
            s.close();
        } catch (Exception e) {
            try { s.close(); } catch (Exception ignored) { }
        }
    }

    private static void reply(OutputStream out, int status, String body) throws Exception {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + status + " OK\r\n"
                + "Content-Type: application/json; charset=utf-8\r\n"
                + "Access-Control-Allow-Origin: *\r\n"
                + "Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS\r\n"
                + "Access-Control-Allow-Headers: *\r\n"
                + "Content-Length: " + b.length + "\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(b);
        out.flush();
    }

    private static String localIp() {
        String best = "";
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress();
                    String n = ni.getName().toLowerCase();
                    if (a.isSiteLocalAddress() && (n.startsWith("wlan") || n.startsWith("eth"))) return ip;
                    if (best.length() == 0 || a.isSiteLocalAddress()) best = ip;
                }
            }
        } catch (Exception ignored) { }
        return best;
    }
}
