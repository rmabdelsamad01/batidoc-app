// When loaded inside batimon's iframe, hide all screens and apply iframe layout
var _inIframe = window.parent !== window;
if(_inIframe){
  document.body.classList.add('bd-iframe');
  document.querySelectorAll('.screen').forEach(function(el){
    el.style.display='none'; el.classList.remove('active');
  });
}

function switchTab(tab){
  const isLogin=tab==='login';
  document.getElementById('form-login').style.display=isLogin?'block':'none';
  document.getElementById('form-signup').style.display=isLogin?'none':'block';
  const tl=document.getElementById('tab-login'),ts=document.getElementById('tab-signup');
  tl.style.background=isLogin?'#224F93':'transparent';tl.style.color=isLogin?'#fff':'#8099b0';
  ts.style.background=isLogin?'transparent':'#224F93';ts.style.color=isLogin?'#8099b0':'#fff';
  document.getElementById('login-err').style.display='none';
  document.getElementById('su-err').style.display='none';
  document.getElementById('su-ok').style.display='none';
}

async function resolveEmail(input){
  // 1. Try email column in profiles
  const {data:byEmail} = await sb.from('profiles').select('email').eq('email', input).maybeSingle();
  if(byEmail?.email) return byEmail.email;

  // 2. Try username
  const {data:byUser} = await sb.from('profiles').select('email,id').eq('username', input).maybeSingle();
  if(byUser?.email) return byUser.email;

  // 3. Try phone — fetch all profiles and do flexible matching
  const normalized = input.replace(/[\s\-().+]/g,'');
  const {data:allProfs} = await sb.from('profiles').select('email,phone,phone_code');
  if(allProfs){
    const match = allProfs.find(r=>{
      if(!r.phone) return false;
      const full = ((r.phone_code||'')+r.phone).replace(/[\s\-().+]/g,'');
      const phoneOnly = r.phone.replace(/[\s\-().+]/g,'');
      return full===normalized || phoneOnly===normalized ||
             full.endsWith(normalized) || normalized.endsWith(phoneOnly);
    });
    if(match?.email) return match.email;
  }

  return null;
}

async function doLogin(){
  const input = document.getElementById('login-user').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-err');

  if(!input || !pass){
    err.textContent='Please enter your identifier and password.';
    err.style.display='block'; return;
  }

  err.textContent='Signing in…'; err.style.display='block';

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  let emailToUse = isEmail ? input : null;

  if(!emailToUse){
    err.textContent='Looking up account…';
    emailToUse = await resolveEmail(input);
    if(!emailToUse){
      err.textContent='No account found with that username or phone number.';
      err.style.display='block'; return;
    }
  }

  err.textContent='Signing in…';
  const {data, error} = await sb.auth.signInWithPassword({email: emailToUse, password: pass});
  if(error){
    if(error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')){
      err.textContent='Your email is not confirmed. Please contact your admin.';
    } else if(error.message.includes('Invalid login') || error.message.includes('invalid_credentials')){
      err.textContent='Incorrect password.';
    } else {
      err.textContent = error.message;
    }
    err.style.display='block'; return;
  }
  err.style.display='none';
  await afterLogin(data.user);
}

async function doSignup(){
  const name=document.getElementById('su-name').value.trim();
  const user=document.getElementById('su-user').value.trim();
  const email=document.getElementById('su-email').value.trim();
  const pass=document.getElementById('su-pass').value;
  const pass2=document.getElementById('su-pass2').value;
  const err=document.getElementById('su-err');
  const ok=document.getElementById('su-ok');
  err.style.display='none';ok.style.display='none';
  if(!name||!user||!email||!pass||!pass2){err.textContent='All fields are required.';err.style.display='block';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';err.style.display='block';return;}
  if(pass!==pass2){err.textContent='Passwords do not match.';err.style.display='block';return;}
  err.textContent='Creating account…';err.style.display='block';

  // Step 1: Create auth user
  const {data,error}=await sb.auth.signUp({email,password:pass,options:{data:{username:user,full_name:name}}});
  if(error){err.textContent=error.message;err.style.display='block';return;}
  err.style.display='none';

  if(data.user){
    // Step 2: Upsert profile with pending status — admin must approve before login is allowed
    await sb.from('profiles').upsert({
      id: data.user.id,
      username: user,
      full_name: name,
      email: email,
      role: 'viewer',
      status: 'pending',
      updated_at: new Date().toISOString()
    }, {onConflict:'id'});

    // Sign out immediately — user must wait for admin approval
    await sb.auth.signOut();
    err.style.display='none';
    ok.textContent=`Account created, ${name}! Your request is pending admin approval. You will be able to log in once approved.`;
    ok.style.display='block';
    setTimeout(()=>switchTab('login'),4000);
  } else {
    ok.textContent=`Account created! Please wait for admin approval before logging in.`;ok.style.display='block';
    setTimeout(()=>switchTab('login'),3000);
  }
}

async function afterLogin(user){
  sbUser=user;
  // Load profile
  let {data:prof}=await sb.from('profiles').select('*').eq('id',user.id).single();
  // If profile doesn't exist yet, create it from user metadata
  if(!prof){
    const meta=user.user_metadata||{};
    const {data:newProf}=await sb.from('profiles').upsert({
      id: user.id,
      username: meta.username||user.email.split('@')[0],
      full_name: meta.full_name||'',
      email: user.email||'',
      role: 'viewer',
      updated_at: new Date().toISOString()
    },{onConflict:'id'}).select().single();
    prof=newProf;
  }
  sbProfile=prof;
  // Block pending users
  if(!prof?.status || prof?.status==='pending'){
    await sb.auth.signOut();
    const err=document.getElementById('login-err');
    err.textContent='Your account is pending admin approval. Please contact your admin.';
    err.style.display='block';
    return;
  }
  // Block suspended users
  if(prof?.status==='suspended'){
    await sb.auth.signOut();
    const err=document.getElementById('login-err');
    err.textContent='Your account has been suspended. Please contact your admin.';
    err.style.display='block';
    return;
  }
  // Show main app
  const displayName = prof?.full_name||prof?.username||user.email||'';
  document.querySelectorAll('.screen').forEach(function(el){el.style.display='none';el.classList.remove('active');});
  const ps=document.getElementById('project-screen');
  if(ps){ps.style.display='flex';ps.classList.add('active');}
  updateUserChip(displayName);
}

function updateUserChip(name){
  ['user-chip','user-chip-label','proj-user'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.textContent=name;
  });
  var dn=document.getElementById('dropdown-user-name');
  if(dn)dn.textContent=name;
}

function toggleUserDropdown(){
  var d=document.getElementById('user-dropdown');
  d.style.display=d.style.display==='none'?'block':'none';
}
document.addEventListener('click',function(e){
  var wrap=document.getElementById('user-dropdown-wrap');
  if(wrap&&!wrap.contains(e.target)){
    var d=document.getElementById('user-dropdown');
    if(d)d.style.display='none';
  }
});

async function doLogout(){
  await sb.auth.signOut();
  sbUser=null;sbProfile=null;
  document.querySelectorAll('.screen').forEach(function(el){el.style.display='none';el.classList.remove('active');});
  const as=document.getElementById('auth-screen');
  if(as){as.style.display='flex';as.classList.add('active');}
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').style.display='none';
  switchTab('login');
}

// Listen for navigate messages from batimon (tab switching after initial load)
window.addEventListener('message', function(e){
  if(!e.data || e.data.type !== 'batidoc-navigate') return;
  var targetPage = e.data.page || 'deliverables';
  if(typeof setPage === 'function') setPage(targetPage);
  if(targetPage === 'deliverables' && typeof loadDeliv === 'function') loadDeliv();
  else if(targetPage === 'deliverables' && typeof renderDeliverables === 'function') renderDeliverables();
  else if(targetPage === 'payments' && typeof renderPayFolders === 'function') renderPayFolders();
});

// Auto-login — reads from URL hash when inside batimon iframe, or uses stored session
(async function(){
  // Check for batimon session payload in URL hash
  var hash = window.location.hash;
  if(_inIframe && hash.indexOf('#bd=') === 0){
    try{
      var payload = JSON.parse(atob(hash.slice(4)));
      var {error} = await sb.auth.setSession({access_token: payload.at, refresh_token: payload.rt});
      if(error) return;
      var {data:{session}} = await sb.auth.getSession();
      if(!session?.user) return;

      // Set globals directly — user is already verified in batimon
      sbUser = session.user;
      var {data:prof} = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      sbProfile = prof;
      updateUserChip(prof?.full_name || prof?.username || session.user.email || '');
      window._allowedProjects = Array.isArray(payload.projects) ? payload.projects : null;

      // Show main screen and render
      document.querySelectorAll('.screen').forEach(function(el){el.style.display='none';el.classList.remove('active');});
      var ms = document.getElementById('main-screen');
      if(ms){ms.style.display='flex';ms.classList.add('active');}
      var targetPage = payload.page || 'deliverables';
      // Defer render until app.js is fully parsed
      setTimeout(function(){
        if(typeof setPage === 'function') setPage(targetPage);
        if(targetPage === 'deliverables'){
          if(typeof renderDeliverables === 'function') renderDeliverables(); // always show immediately
          if(typeof loadDeliv === 'function') loadDeliv(); // sync from Supabase in background
        } else if(targetPage === 'payments' && typeof renderPayFolders === 'function') renderPayFolders();
      }, 0);
    } catch(err){ console.error('batidoc iframe init error', err); }
    return;
  }

  // Normal standalone login — check stored session
  var {data:{session}}=await sb.auth.getSession();
  if(session?.user) await afterLogin(session.user);
})();
