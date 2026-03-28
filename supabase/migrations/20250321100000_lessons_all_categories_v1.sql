-- Lessons: one booklet (3 pages) per category — Arabic + CSS-only interactives.
-- Uses <details> and checkbox/radio + label[for] (no <script>: React innerHTML will not run scripts).
-- Truncates lessons; re-seeds from categories.

TRUNCATE TABLE lessons;

INSERT INTO lessons (title, content_html, category_id)
SELECT 'شرح ' || v.cat_name, v.html, c.id
FROM (VALUES
(
  'الاستفهام',
  $lesson$
<style>
.lint{font-size:1rem;line-height:1.7}
.lint .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.75rem;border-radius:10px;text-align:center;display:block;margin:.5rem 0}
.lint .hit:hover{background:rgba(0,0,0,.06)}
.lint input.t{position:absolute;opacity:0;width:0;height:0}
.lint .out{margin-top:.75rem;padding:.75rem;background:rgba(0,0,0,.04);border-radius:8px;max-height:0;opacity:0;overflow:hidden;transition:.35s}
.lint input.t:checked~.out{max-height:280px;opacity:1}
.lint .row{display:flex;flex-wrap:wrap;gap:.35rem;justify-content:center;font-size:1.25rem}
</style>
<div class="lesson-page lint"><h2>الاستفهام</h2><p>الاستفهام طلبٌ بيانَ شيءٍ. أدوات الاستفهام مثل: <strong>هل، من، ما، ماذا، متى، أين، كم، كيف، أي</strong> — لكلٍّ معنى سؤال مختلف.</p></div>
<div class="lesson-page lint"><h2>جرّب</h2><p>اضغط على المربع لإظهار أدوات الاستفهام.</p>
<input type="checkbox" id="lint-demo" class="t"/>
<div class="out"><div class="row"><span>هل</span><span>؟</span><span>من</span><span>؟</span><span>ما</span><span>؟</span><span>متى</span><span>؟</span><span>أين</span><span>؟</span></div><p>مثل: <em>هل جاء الزائر؟ / من هذا؟ / ما اسمُك؟</em></p></div>
<label for="lint-demo" class="hit"><strong>أدوات الاستفهام</strong></label>
</div>
<div class="lesson-page lint"><h2>تلخيص</h2><p>إذا رأيتَ أداة استفهام فالجملة تطلب معلومة. نوع الأداة يقترن بعاقل، غير عاقل، زمان، مكان، عدد…</p></div>
$lesson$
),
(
  'النفي',
  $lesson$
<style>
.ln .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.75rem;border-radius:10px;text-align:center;display:block;margin:.5rem 0}
.ln input.t{position:absolute;opacity:0;width:0;height:0}
.ln .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(4rem,1fr));gap:.5rem;margin-top:.75rem;max-height:0;opacity:0;overflow:hidden;transition:.35s}
.ln input.t:checked~.grid{max-height:120px;opacity:1}
.ln .pill{padding:.4rem;border-radius:6px;background:#2d3748;color:#fff;text-align:center}
</style>
<div class="lesson-page ln"><h2>النفي</h2><p>النفي إخبارٌ بعدم وقوع الفعل أو عدم صحة الخبر. من أدواته: <strong>لا، لم، لن، ليس، ما</strong>.</p></div>
<div class="lesson-page ln"><h2>جرّب</h2><p>اضغط لإظهار أدوات نفي شائعة.</p>
<input type="checkbox" id="ln-demo" class="t"/>
<div class="grid"><span class="pill">لا</span><span class="pill">لم</span><span class="pill">لن</span><span class="pill">ليس</span><span class="pill">ما</span></div>
<label for="ln-demo" class="hit"><strong>أدوات النفي</strong></label>
</div>
<div class="lesson-page ln"><h2>تلخيص</h2><p><strong>لا</strong> للحاضر، <strong>لم</strong> للماضي، <strong>لن</strong> للمستقبل، <strong>ليس</strong> لنفي الجملة الاسمية — راقب الفعل والزمن.</p></div>
$lesson$
),
(
  'جنس',
  $lesson$
<style>
.lg .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.75rem;border-radius:10px;display:block;margin:.5rem 0;text-align:center}
.lg input.t{position:absolute;opacity:0;width:0;height:0}
.lg .card{margin-top:.75rem;padding:1rem;border-radius:10px;text-align:center;display:none}
.lg input.t:not(:checked)~.card.f{display:block;background:#dbeafe;color:#1e3a5f}
.lg input.t:checked~.card.m{display:block;background:#fce7f3;color:#5b1e3a}
</style>
<div class="lesson-page lg"><h2>جنس الاسم</h2><p>الاسم <strong>مذكّر</strong> أو <strong>مؤنّث</strong>. علامات التأنيث: التاء، الألف المقصورة، ألف التأنيث، وغيرها.</p></div>
<div class="lesson-page lg"><h2>جرّب</h2><p>اضغط للتبديل بين مثال مذكّر ومؤنّث.</p>
<input type="checkbox" id="lg-demo" class="t"/>
<div class="card f"><strong>مذكّر:</strong> طالب</div>
<div class="card m"><strong>مؤنّث:</strong> طالبة</div>
<label for="lg-demo" class="hit">📗 طالب / طالبة — تبديل</label>
</div>
<div class="lesson-page lg"><h2>تلخيص</h2><p>الجنس يؤثّر على الصفة والإشارة ومطابقة الكلمات في الجملة.</p></div>
$lesson$
),
(
  'المعرفة',
  $lesson$
<style>
.lm .hit{cursor:pointer;padding:.75rem;border-radius:10px;border:2px dashed var(--border,#c9b896);display:block;margin:.5rem 0;text-align:center}
.lm input.t{position:absolute;opacity:0;width:0;height:0}
.lm .reveal{margin-top:.75rem;max-height:0;opacity:0;overflow:hidden;transition:.35s}
.lm input.t:checked~.reveal{max-height:160px;opacity:1}
</style>
<div class="lesson-page lm"><h2>المعرفة والنكرة</h2><p><strong>المعرفة</strong> تدلّ على معيّن. <strong>النكرة</strong> لمعنى عام غير معيّن.</p></div>
<div class="lesson-page lm"><h2>جرّب</h2><p>اضغط لإظهار أثر «ال» التعريفية.</p>
<input type="checkbox" id="lm-demo" class="t"/>
<div class="reveal"><p><strong>نكرة:</strong> رأيتُ كتابًا.<br/><strong>معرفة:</strong> رأيتُ <em>ال</em>كتابَ.</p></div>
<label for="lm-demo" class="hit"><strong>أل التعريف</strong></label>
</div>
<div class="lesson-page lm"><h2>تلخيص</h2><p>«ال» تفيد التعريف في أغلب الأحوال؛ بلا «ال» غالبًا نكرة إن لم يُعرَف المقصود.</p></div>
$lesson$
),
(
  'النسبة',
  $lesson$
<style>
.lr details{margin:.5rem 0}
.lr summary{cursor:pointer;padding:.5rem;border-radius:8px;border:2px dashed var(--border,#c9b896)}
.lr .box{padding:.75rem;margin-top:.35rem;background:rgba(0,0,0,.04);border-radius:8px}
</style>
<div class="lesson-page lr"><h2>النسبة</h2><p>للدلالة على الانتماء — غالبًا <strong>ياء النسبة</strong>: «مصريّ، بغداديّ».</p></div>
<div class="lesson-page lr"><h2>جرّب</h2>
<details><summary>اضغط لعرض مثال</summary><div class="box"><p><strong>منسوب إليه:</strong> مصر → <strong>منسوب:</strong> مِصريّ</p></div></details>
</div>
<div class="lesson-page lr"><h2>تلخيص</h2><p>الاسم المنسوب يصف الانتماء لبلد أو صفة أو غير ذلك بحسب السياق.</p></div>
$lesson$
),
(
  'العدد',
  $lesson$
<style>
.lc .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.6rem;border-radius:8px;display:inline-block;margin:.25rem}
.lc .pick{margin:.25rem 0}
.lc .lc-r{position:absolute;opacity:0;width:0;height:0}
.lc .pan{margin-top:.75rem;min-height:4rem}
.lc .pan .p{opacity:0;max-height:0;overflow:hidden;transition:.3s}
.lc #lc-n1:checked~.pan .p1,.lc #lc-n2:checked~.pan .p2,.lc #lc-n3:checked~.pan .p3{opacity:1;max-height:120px}
</style>
<div class="lesson-page lc"><h2>العدد</h2><p>يدلّ الكلام على <strong>مفرد</strong> أو <strong>مثنّى</strong> أو <strong>جمع</strong>.</p></div>
<div class="lesson-page lc"><h2>جرّب</h2><p>اختر نوع العدد (أو استخدم الأزرار أسفل النتيجة):</p>
<input type="radio" name="lcnum" id="lc-n1" class="lc-r"/>
<input type="radio" name="lcnum" id="lc-n2" class="lc-r"/>
<input type="radio" name="lcnum" id="lc-n3" class="lc-r"/>
<div class="pan"><p class="p p1"><strong>مفرد:</strong> كتاب.</p><p class="p p2"><strong>مثنّى:</strong> كتابان.</p><p class="p p3"><strong>جمع:</strong> كتب / كتبات.</p></div>
<div class="pick">
<label for="lc-n1" class="hit">مفرد</label>
<label for="lc-n2" class="hit">مثنّى</label>
<label for="lc-n3" class="hit">جمع</label>
</div>
</div>
<div class="lesson-page lc"><h2>تلخيص</h2><p>راقب ألِ المثنى والجمع والتنوين دلالةً على العدد.</p></div>
$lesson$
),
(
  'ضمائر',
  $lesson$
<style>
.lp .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.75rem;border-radius:10px;display:block;margin:.5rem 0;text-align:center}
.lp input.t{position:absolute;opacity:0;width:0;height:0}
.lp .o{margin-top:.75rem;max-height:0;opacity:0;overflow:hidden;transition:.35s}
.lp input.t:checked~.o{max-height:200px;opacity:1}
</style>
<div class="lesson-page lp"><h2>الضمائر</h2><p><strong>منفصلة</strong> (هو، أنا…) و<strong>متصلة</strong> بالفعل (ت، نا، ه…).</p></div>
<div class="lesson-page lp"><h2>جرّب</h2>
<input type="checkbox" id="lp-demo" class="t"/>
<div class="o"><p><strong>منفصل:</strong> هو ذهب.<br/><strong>متصل (فاعل):</strong> ذهب<strong>ت</strong>.</p></div>
<label for="lp-demo" class="hit"><strong>مثال منفصل / متصل</strong></label>
</div>
<div class="lesson-page lp"><h2>تلخيص</h2><p>موقع الضمير وارتباطه بالفعل يحدّد الفاعل أو المفعول به.</p></div>
$lesson$
),
(
  'الإشارة',
  $lesson$
<style>
.li .hit{cursor:pointer;text-align:center;padding:1rem;border-radius:10px;border:2px dashed var(--border,#c9b896);display:block;margin-top:.75rem}
.li input.t{position:absolute;opacity:0;width:0;height:0}
.li p.near,.li p.far{display:none;margin-top:.75rem;text-align:center;font-size:1.2rem}
.li input:not(:checked)~p.near{display:block;color:#1d4ed8}
.li input:checked~p.far{display:block;color:#b45309}
</style>
<div class="lesson-page li"><h2>أسماء الإشارة</h2><p><strong>قريب</strong> (هذا، هذه) و<strong>بعيد</strong> (ذلك، تلك) مع مراعاة الجنس والعدد.</p></div>
<div class="lesson-page li"><h2>جرّب</h2><p>التبديل بين قريب وبعيد:</p>
<input type="checkbox" id="li-demo" class="t"/>
<p class="near">هذا قريب 🔵</p>
<p class="far">ذلك بعيد 🟠</p>
<label for="li-demo" class="hit">قريب ↔ بعيد</label>
</div>
<div class="lesson-page li"><h2>تلخيص</h2><p>البعد والجنس والعدد ثلاثية اختيار اسم الإشارة.</p></div>
$lesson$
),
(
  'المكان',
  $lesson$
<style>
.lpl details{margin:.5rem 0}
.lpl summary{cursor:pointer;padding:.5rem;border-radius:8px;background:rgba(0,0,0,.05)}
</style>
<div class="lesson-page lpl"><h2>المكان</h2><p><strong>ظرف المكان</strong> — أين وقع الفعل: <em>تحت، فوق، أمام…</em></p></div>
<div class="lesson-page lpl"><h2>جرّب</h2>
<details><summary>📍 جملة فيها ظرف مكان</summary><p>جلس <strong>تحت</strong> الشجرةِ.</p></details>
</div>
<div class="lesson-page lpl"><h2>تلخيص</h2><p>الظرف يحدّد المكان؛ تفرّقه عن ظرف الزمان.</p></div>
$lesson$
),
(
  'زمان',
  $lesson$
<style>
.lz details{margin:.5rem 0}
.lz summary{cursor:pointer;padding:.5rem;border-radius:8px;background:rgba(0,0,0,.05)}
</style>
<div class="lesson-page lz"><h2>الزمان</h2><p><strong>ظرف الزمان</strong> — متى: <em>صباحًا، اليوم، غدًا…</em></p></div>
<div class="lesson-page lz"><h2>جرّب</h2>
<details><summary>🕐 جملة فيها ظرف زمان</summary><p>درسنا <strong>صباحًا</strong>.</p></details>
</div>
<div class="lesson-page lz"><h2>تلخيص</h2><p>«متى» للزمان، «أين» للمكان.</p></div>
$lesson$
),
(
  'أقسام الجملة',
  $lesson$
<style>
.la{font-size:1rem;line-height:1.7}
.la .hit{cursor:pointer;display:block;padding:.75rem;border-radius:10px;border:2px dashed var(--border,#c9b896);text-align:center;margin:.5rem 0}
.la input.t{position:absolute;opacity:0;width:0;height:0}
.la .bow{display:flex;align-items:center;justify-content:center;gap:.35rem;flex-wrap:wrap;margin:.75rem 0}
.la .arr{display:inline-block;width:0;height:4px;background:linear-gradient(90deg,#333,#888);border-radius:2px;transition:width .55s ease}
.la input.t:checked~.bow .arr{width:100px}
.la .lbl{margin:.25rem;font-size:1.4rem}
.la .reveal{margin-top:.75rem;padding:.75rem;background:rgba(34,197,94,.12);border-radius:10px;max-height:0;opacity:0;overflow:hidden;transition:.4s}
.la input.t:checked~.reveal{max-height:220px;opacity:1}
</style>
<div class="lesson-page la"><h2>أقسام الجملة</h2><p>أقسام مثل <strong>الفعل</strong> و<strong>الفاعل</strong> و<strong>المفعول به</strong> و<strong>المبتدأ والخبر</strong> حسب نوع الجملة.</p></div>
<div class="lesson-page la"><h2>تجربة: فاعل ومفعول به</h2><p>مشهد الرّمي: من فعل؟ وما الذي وقع عليه الفعل؟</p>
<input type="checkbox" id="la-demo" class="t"/>
<div class="bow"><span class="lbl">🏹 رامٍ</span><span class="arr"></span><span class="lbl">🎯</span></div>
<div class="reveal"><p><strong>الرامي</strong> = <strong>فاعل</strong>.<br/><strong>الهدف</strong> = <strong>مفعول به</strong>.<br/><strong>القوس</strong> أداة في اليد ضمن المشهد التعليمي.</p></div>
<label for="la-demo" class="hit">اضغط لرمي السهم نحو الهدف 🎯</label>
</div>
<div class="lesson-page la"><h2>تلخيص</h2><p>اسأل: من فعل؟ ما المفعول؟ لتفكيك الجملة الفعلية.</p></div>
$lesson$
),
(
  'صفة',
  $lesson$
<style>
.ls .hit{cursor:pointer;border:2px dashed var(--border,#c9b896);padding:.75rem;border-radius:10px;text-align:center;display:block;margin:.5rem 0}
.ls input.t{position:absolute;opacity:0;width:0;height:0}
.ls .bond{margin-top:1rem;display:flex;align-items:center;justify-content:center;gap:.5rem;flex-wrap:wrap}
.ls .n,.ls .s{padding:.5rem .75rem;border-radius:8px;border:2px solid transparent;transition:.35s}
.ls input.t:checked~.bond .n,.ls input.t:checked~.bond .s{border-color:#059669;background:rgba(16,185,129,.12)}
.ls .link{opacity:.4;transition:.35s}
.ls input.t:checked~.bond .link{opacity:1;color:#059669;font-weight:700}
</style>
<div class="lesson-page ls"><h2>الصفة والموصوف</h2><p>الصفة تنسج مع الموصوف في التعريف والنوع والعدد.</p></div>
<div class="lesson-page ls"><h2>جرّب</h2>
<input type="checkbox" id="ls-demo" class="t"/>
<div class="bond"><span class="n">ولدٌ</span><span class="link">⟷</span><span class="s">شجاعٌ</span></div>
<label for="ls-demo" class="hit"><strong>أظهر التوافق بين الموصوف والصفة</strong></label>
</div>
<div class="lesson-page ls"><h2>تلخيص</h2><p>الصفة تتبع الموصوف نحويًا.</p></div>
$lesson$
),
(
  'الاسم الموصول',
  $lesson$
<style>
.lw details{margin:.5rem 0}
.lw summary{cursor:pointer;padding:.6rem;border-radius:8px;border:2px dashed var(--border,#c9b896)}
</style>
<div class="lesson-page lw"><h2>الاسم الموصول</h2><p>يربط جملتين: <strong>الذي، التي، ما، من</strong>…</p></div>
<div class="lesson-page lw"><h2>جرّب</h2>
<details><summary>🔗 مثال بـ «الذي»</summary><p>رأيتُ الولدَ <strong>الذي</strong> يقرأ.</p></details>
</div>
<div class="lesson-page lw"><h2>تلخيص</h2><p>الموصول يعود إلى اسم قبله ويدخل صلة.</p></div>
$lesson$
),
(
  'زمان الفعل',
  $lesson$
<style>
.lvf .hit{cursor:pointer;padding:.45rem .7rem;border-radius:8px;border:2px solid #94a3b8;display:inline-block;margin:.2rem}
.lvf .lvf-r{position:absolute;opacity:0;width:0;height:0}
.lvf .out{margin-top:.75rem;min-height:3rem}
.lvf .out .z{opacity:0;max-height:0;overflow:hidden;transition:.3s}
.lvf #lvf-z1:checked~.out .z1,.lvf #lvf-z2:checked~.out .z2,.lvf #lvf-z3:checked~.out .z3{opacity:1;max-height:120px}
</style>
<div class="lesson-page lvf"><h2>زمان الفعل</h2><p><strong>ماضٍ، مضارع، أمر</strong> — زمن الحدث.</p></div>
<div class="lesson-page lvf"><h2>جرّب</h2>
<input type="radio" name="lvfz" id="lvf-z1" class="lvf-r"/>
<input type="radio" name="lvfz" id="lvf-z2" class="lvf-r"/>
<input type="radio" name="lvfz" id="lvf-z3" class="lvf-r"/>
<div class="out"><p class="z z1">جلسَ — ماضٍ.</p><p class="z z2">يجلسُ — مضارع.</p><p class="z z3">اجلسْ — أمر.</p></div>
<div>
<label for="lvf-z1" class="hit">ماضٍ</label>
<label for="lvf-z2" class="hit">مضارع</label>
<label for="lvf-z3" class="hit">أمر</label>
</div>
</div>
<div class="lesson-page lvf"><h2>تلخيص</h2><p>راقب علامات الفعل وحروف المضارعة.</p></div>
$lesson$
)
) AS v(cat_name, html)
JOIN categories c ON c.name = v.cat_name;
