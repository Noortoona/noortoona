(()=> {
  const KEY="halaSession", SID="halaVisitorId";
  const session=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}};
  const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
  let resolver=null, purpose="login", supervisorPrice=199;

  function ensureVisitor(){
    let id=localStorage.getItem(SID);
    if(!id){id=crypto.randomUUID().replaceAll("-","");localStorage.setItem(SID,id)}
    return id;
  }
  async function track(event,metadata={}){
    try{await fetch("/api/analytics/track",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:ensureVisitor(),event,path:location.pathname,metadata}),keepalive:true})}catch{}
  }
  track("page_view",{referrer:document.referrer?new URL(document.referrer).hostname:"direct"});
  fetch("/api/events/supervisor").then(r=>r.ok?r.json():null).then(x=>{if(x?.amountSar)supervisorPrice=x.amountSar}).catch(()=>{});

  function modal(){
    let el=document.getElementById("halaAuthModal");
    if(el)return el;
    el=document.createElement("div");el.id="halaAuthModal";el.className="auth-modal";el.innerHTML=`
      <div class="auth-backdrop" data-auth-close></div>
      <section class="auth-card" dir="rtl">
        <button class="auth-close" data-auth-close>×</button>
        <img src="/assets/brand/hala-logo-dark.svg" alt="هلا" class="auth-logo">
        <div id="authPhoneStep">
          <span class="auth-kicker">دخول سريع</span><h2>رقم جوالك يكفي</h2>
          <p>نرسل لك رمز تحقق على واتساب، وبعدها تفتح لوحة مناسباتك مباشرة.</p>
          <label><span>رقم الجوال</span><div class="phone-field"><b>+966</b><input id="authPhone" inputmode="tel" autocomplete="tel" placeholder="5XXXXXXXX" maxlength="12"></div></label>
          <button id="sendOtpBtn" class="gold-btn auth-main">إرسال رمز التحقق</button>
          <small>لن نطلب كلمة مرور.</small>
        </div>
        <div id="authCodeStep" class="hidden">
          <span class="auth-kicker">تحقق الجوال</span><h2>أدخل الرمز</h2>
          <p id="authSentTo"></p>
          <input id="authCode" class="otp-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">
          <button id="verifyOtpBtn" class="gold-btn auth-main">تأكيد والدخول</button>
          <button id="changePhoneBtn" class="auth-link">تغيير الرقم</button>
        </div>
        <p id="authError" class="auth-error"></p>
      </section>`;
    document.body.appendChild(el);
    el.querySelectorAll("[data-auth-close]").forEach(b=>b.onclick=()=>close(false));
    el.querySelector("#changePhoneBtn").onclick=()=>step("phone");
    el.querySelector("#sendOtpBtn").onclick=requestOtp;
    el.querySelector("#verifyOtpBtn").onclick=verifyOtp;
    return el;
  }
  function step(which){
    const m=modal();m.querySelector("#authPhoneStep").classList.toggle("hidden",which!=="phone");m.querySelector("#authCodeStep").classList.toggle("hidden",which!=="code");m.querySelector("#authError").textContent="";
    setTimeout(()=>m.querySelector(which==="phone"?"#authPhone":"#authCode")?.focus(),100);
  }
  function open(){const m=modal();m.classList.add("open");step("phone")}
  function close(cancel=true){modal().classList.remove("open");if(cancel&&resolver){resolver(null);resolver=null}}
  function normalizedPhone(){
    let p=String(modal().querySelector("#authPhone").value||"").replace(/\D/g,"");
    if(p.startsWith("966"))return p;if(p.startsWith("0"))p=p.slice(1);return "966"+p;
  }
  async function requestOtp(){
    const m=modal(),btn=m.querySelector("#sendOtpBtn"),phone=normalizedPhone();m.querySelector("#authError").textContent="";
    if(!/^9665\d{8}$/.test(phone)){m.querySelector("#authError").textContent="أدخل رقم جوال سعودي صحيح";return}
    btn.disabled=true;btn.textContent="جاري الإرسال…";
    try{const r=await fetch("/api/auth/otp/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone})}),d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر إرسال الرمز");m.dataset.phone=phone;m.querySelector("#authSentTo").textContent="أرسلنا الرمز إلى +"+phone;step("code");track("otp_requested")}
    catch(e){m.querySelector("#authError").textContent=e.message}
    finally{btn.disabled=false;btn.textContent="إرسال رمز التحقق"}
  }
  async function verifyOtp(){
    const m=modal(),btn=m.querySelector("#verifyOtpBtn"),phone=m.dataset.phone,code=String(m.querySelector("#authCode").value||"").replace(/\D/g,"");m.querySelector("#authError").textContent="";
    if(!/^\d{6}$/.test(code)){m.querySelector("#authError").textContent="أدخل الرمز المكوّن من 6 أرقام";return}
    btn.disabled=true;btn.textContent="جاري التحقق…";
    try{const r=await fetch("/api/auth/otp/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone,code})}),d=await r.json();if(!r.ok)throw new Error(d.error||"رمز غير صحيح");const s={token:d.token,expiresAt:d.expiresAt,user:d.user};save(s);close(false);track("login_verified",{role:d.user.role});if(resolver){resolver(s);resolver=null}else route(d.user)}
    catch(e){m.querySelector("#authError").textContent=e.message}
    finally{btn.disabled=false;btn.textContent="تأكيد والدخول"}
  }
  function route(user){location.href=user?.role==="admin"?"/admin.html":"/customer.html"}
  async function validSession(){
    const s=session();if(!s?.token)return null;
    try{const r=await fetch("/api/auth/me",{headers:{authorization:`Bearer ${s.token}`}});if(!r.ok){localStorage.removeItem(KEY);return null}const d=await r.json();s.user=d.user;save(s);return s}catch{return s}
  }
  async function ensureLogin(reason="login"){
    const s=await validSession();if(s)return s;
    purpose=reason;open();return new Promise(resolve=>{resolver=resolve});
  }
  window.HALA_AUTH={session,ensureLogin,track,get supervisorPrice(){return supervisorPrice}};
  const login=document.getElementById("loginBtn");if(login)login.onclick=async()=>{const s=await ensureLogin("login");if(s)route(s.user)};
})();