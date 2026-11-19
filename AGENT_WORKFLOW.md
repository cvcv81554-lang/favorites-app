# AGENT_WORKFLOW — نظام العمل لتطوير Favorites

دليل دائم لكل مهمة تطوير في Favorites: أي أداة تُستخدم، ومتى، ولماذا. القواعد العامة في `../CLAUDE.md` تسبق هذا الملف دائمًا: بوابة +18، الخصوصية، عدم الحذف المباشر، عدم كسر الموجود، والاختبار قبل الدفع.

## الأدوات المثبّتة وحقيقة كل واحدة

| الأداة | نوعها الحقيقي | ما تقدّمه فعلًا | ما **لا** تفعله |
|---|---|---|---|
| **Superpowers** (`superpowers@claude-plugins-official`) | إضافة مهارات + خطّاف بدء جلسة | منهجية: `brainstorming`، `writing-plans`، `executing-plans`، `test-driven-development`، `systematic-debugging`، `verification-before-completion`، `requesting-code-review` | ليست وكيلًا مستقلًا؛ لا تبني شيئًا وحدها |
| **UI UX Pro Max** (`ui-ux-pro-max@ui-ux-pro-max-skill`) | مهارة + قاعدة بيانات تصميم (CSV) وسكربت بحث Python محلي | أنماط، لوحات ألوان، خطوط، قواعد UX، توليد «نظام تصميم» حسب نوع المنتج | لا تعدّل الكود؛ ولا تتصل بالشبكة |
| **Addy Osmani Agent Skills** (`agent-skills@addy-agent-skills`) | 25 مهارة هندسية | `spec-driven-development`، `planning-and-task-breakdown`، `incremental-implementation`، `frontend-ui-engineering`، `performance-optimization`، `security-and-hardening`، `code-review-and-quality`، `debugging-and-error-recovery` | لا تختبر ولا تنشر وحدها |
| **Vercel Agent Skills** (مهارتان فقط في `~/.claude/skills`) | مهارات مراجعة | `web-design-guidelines` (100+ قاعدة وصول/أداء/UX تُجلب من مستودع Vercel)، `writing-guidelines` (نصوص الواجهة) | بقية مهاراتها لـ React/Next/Vercel ولا تناسب تطبيقًا بلا إطار؛ **لم تُثبَّت عمدًا** |
| **Playwright** (`playwright-core` 1.65 في المشروع) | مكتبة أتمتة متصفح | اختبارات `tests/*.mjs` في Edge/Chrome الحقيقي: نقر، لمس، ريموت (أسهم)، لقطات، قياس أداء | **ليس** اختبارًا على iPhone أو جهاز Android TV حقيقي |
| **feature-dev** · **pr-review-toolkit** · **frontend-design** · **security-guidance** (مثبّتة سابقًا) | وكلاء فرعيون + مهارات + خطّافات | استكشاف الكود، تصميم البنية، مراجعة مستقلة، صيد الأعطال الصامتة، تحذيرات أمان أثناء التعديل | لا تُغني عن تشغيل الاختبارات |

> بعد أي تثبيت جديد: `/reload-plugins` أو جلسة جديدة كي تظهر المهارات.

## أدوات التصميم والحركة (المرحلة 2 — 2026-11-19)

| الأداة | القرار | السبب |
|---|---|---|
| **Motion Design Skill** (LottieFiles) | ✅ مثبّتة (`~/.claude/skills/motion-design`) | مبادئ توقيت وتخفيف وتتابع (مستقلة عن المكتبة)؛ لا تضيف شيئًا للتطبيق |
| **Motion AI Kit** (`npx motion-ai`) | ⏳ يحتاج تشغيلًا تفاعليًا من المستخدم | مثبّته تفاعلي فقط؛ يضيف مهارات وخادم توثيق لمكتبة Motion (غير مستخدمة في التطبيق) |
| **GSAP** | ❌ لم تُضف للتطبيق | Web Animations API + CSS تكفي لكل الحركات المطلوبة بلا وزن إضافي ولا استهلاك بطارية |
| **Three.js / Theatre.js / VFX-JS / Three Quarks** | ❌ مرفوضة | مكتبات ثلاثية الأبعاد/تأثيرات ثقيلة (مئات KB) بلا فائدة حقيقية لتطبيق مكتبة وصور، وتستهلك البطارية |
| **React Postprocessing** | ❌ غير متوافقة | تتطلب React، والتطبيق JavaScript بلا إطار |

**قاعدة الحركة في Favorites:**
- CSS transitions/animations أو Web Animations API فقط، على `transform` و`opacity`.
- مدة 150–320ms، و`prefers-reduced-motion` يلغيها.
- لا حركات مستمرة في الخلفية.

## الوكلاء وأدوارهم

| الدور | الوكيل/المهارة المتاحة فعلًا | ملاحظة |
|---|---|---|
| تحليل المشروع واكتشاف المشكلات | `feature-dev:code-explorer`، `Explore` | قراءة فقط |
| UI/UX والتصميم | المهارات: `ui-ux-pro-max`، `frontend-design`، `web-design-guidelines` | لا يوجد وكيل تصميم مستقل؛ الجلسة الرئيسية تطبّقها |
| الحركة والانتقالات | مهارة `motion-design` | مبادئ؛ التنفيذ CSS/WAAPI |
| الأداء والسرعة | `agent-skills:web-performance-auditor` + مهارة `performance-optimization` + قياسات `tests/perf.mjs` | |
| تطوير الميزات | `feature-dev:code-architect` (تصميم)، ثم الجلسة الرئيسية (تنفيذ) | |
| الاستديو والتحديث في الخلفية | `feature-dev:code-explorer` للخريطة + الجلسة الرئيسية | |
| الاكتشاف والتوصيات | `feature-dev:code-explorer` + الجلسة الرئيسية | |
| الاختبارات والجودة | `agent-skills:test-engineer`، `pr-review-toolkit:pr-test-analyzer` | |
| الأمان والاستقرار | `agent-skills:security-auditor`، `pr-review-toolkit:silent-failure-hunter`، خطّاف `security-guidance` | |
| المراجعة النهائية | `pr-review-toolkit:code-reviewer` أو `agent-skills:code-reviewer` | على الفرق كاملًا قبل الدفع |

**التشغيل المتوازي بلا تعارض:**
- الوكلاء الفرعيون يُطلقون **معًا للقراءة والتحليل والمراجعة فقط**.
- **التعديل على الملفات تقوم به الجلسة الرئيسية وحدها**. هي تدمج نتائج الوكلاء بعد التحقق منها في الكود، فلا يعدّل وكيلان الملف نفسه.
- إن لزم تعديل متوازٍ حقيقي: `isolation: "worktree"` لكل وكيل، ثم دمج يدوي.
- **نتائج الوكلاء تُعامل كفرضيات:** كل ادعاء يُتحقق منه في الكود قبل إصلاحه، ويُختبر بعد الإصلاح.

## سير العمل (لكل مهمة)

### 1) التخطيط والتحليل — Superpowers (+ Addy)
- افهم الطلب: `superpowers:brainstorming` للأفكار الغامضة، و`agent-skills:spec-driven-development` للمواصفة.
- اقرأ الكود الموجود قبل أي قرار، عبر وكيل `feature-dev:code-explorer` للأقسام الكبيرة.
- قسّم العمل: `superpowers:writing-plans` أو `agent-skills:planning-and-task-breakdown`، بمهام صغيرة لكل منها معيار قبول واختبار.
- **المخرج:** قائمة مهام مرقّمة، ولكل مهمة الملفات المتأثرة وطريقة التحقق.

### 2) التصميم وتجربة المستخدم — UI UX Pro Max (+ frontend-design)
- `ui-ux-pro-max` للبحث في الأنماط واللوحات والخطوط وقواعد UX المناسبة لـ«تطبيق مكتبة شخصية داكن للجوال والتلفاز».
- `frontend-design` لاتجاه بصري متميز غير قوالبي.
- **الالتزام بهوية Favorites:**
  - متغيرات CSS في `:root`: `--acc` و`--acc2` و`--rose` و`--grad` و`--card` و`--line` و`--glass`.
  - مستويات `data-accent`، والوضع الداكن، وRTL.
- **لكل منصة تصميمها:**
  - **الجوال:** لمس، أهداف ≥ 44px، سحب أفقي.
  - **التلفاز:** `html.tvapp`، تركيز مرئي واضح، تنقل بالأسهم، نصوص أكبر، بلا اعتماد على اللمس.
- **المخرج:** وصف الشاشة (التسلسل، المكوّنات، الحالات: فارغ/تحميل/خطأ)، قبل كتابة الكود.

### 3) التطوير — Addy Osmani + Vercel (حسب المناسب)
- `agent-skills:incremental-implementation`: شرائح رأسية صغيرة، كل شريحة تُبنى وتُختبر.
- `agent-skills:frontend-ui-engineering` لبنية الواجهة، و`performance-optimization` لما يمس آلاف السجلات.
- `security-and-hardening` لأي بيانات واردة (API، استيراد، مزامنة)، وكل نص خارجي يمر عبر `esc()`.
- **قواعد المشروع:**
  - وحدة جديدة = ملف جديد في `src/js` برقم بعد آخر وحدة.
  - لفّ الدوال القائمة (`openDetail=function(){…_od.apply…}`) بدل تعديلها.
  - لا تغيير في صيغة البيانات بلا توافق رجعي.
- **ممنوع:**
  - تخمين أعمار أو بيانات.
  - نسخ مفاتيح مكشوفة.
  - كشط مواقع تمنعه.

### 4) الاختبار — Playwright
- لكل ميزة: ملف أو قسم في `tests/*.mjs` ببيانات تجريبية **معروفة النتائج**، ولا شبكة خارجية (`ctx.route('https://**', …)` تُرجع ردودًا وهمية).
- **يُختبر:**
  - الحالات الطبيعية والفارغة وفشل الاتصال.
  - الجوال (390×844) والشاشة العريضة.
  - التلفاز (`?tv=1&mock=1`، بالأسهم وOK والرجوع فقط).
  - الأداء على مكتبة كبيرة.
- `npm test` كاملًا قبل أي دفع، فالدفع إلى `main` ينشر نسخة.
- مراجعة الواجهة: `web-design-guidelines` على الملفات المعدّلة، ولقطات `tests/out/*.png` تُفحص بالعين.

### 5) المراجعة قبل اعتبار المهمة مكتملة
- `superpowers:verification-before-completion`: لا ادعاء نجاح بلا أمر تحقق شُغّل فعلًا ومُخرجه.
- وكيل `pr-review-toolkit:code-reviewer` (أو `feature-dev:code-reviewer`) على الفرق الكامل، و`pr-review-toolkit:silent-failure-hunter` لأي `catch`.
- إصلاح ما يثبت ثم إعادة الاختبار. التقرير يذكر **ما لم يُختبر** (الأجهزة الحقيقية، الـ API الحي).
- `claude-md-management:revise-claude-md` لحفظ الدروس الدائمة في `CLAUDE.md`.

## قائمة تحقق سريعة لكل مهمة
- [ ] قرأت الكود المتأثر وفهمت تدفق البيانات.
- [ ] خطة بمهام صغيرة ومعايير قبول.
- [ ] تصميم الجوال والتلفاز (كلٌّ على حدة).
- [ ] الكود: `esc()` لكل نص خارجي، وبوابة +18 قبل أي طلب، ولا مفاتيح في الكود.
- [ ] اختبار Playwright جديد + `npm test` كامل ناجح.
- [ ] مراجعة وكيل مستقل وإصلاح ما يثبت.
- [ ] تقرير صادق: ما نُفّذ، ما اختُبر، ما لم يُختبر.
