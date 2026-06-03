// ── deliverables persistence ──────────────────────────────────
async function saveDeliv(){
  try{
    var json=JSON.stringify(deliverables);
    await sb.from('project_info').delete().eq('project','batidoc').eq('key','deliverables');
    await sb.from('project_info').insert({project:'batidoc',key:'deliverables',value:json,updated_at:new Date().toISOString()});
  }catch(e){console.error('saveDeliv',e);}
}
async function loadDeliv(){
  renderDeliverables(); // show defaults immediately — never leave blank
  try{
    var {data,error}=await sb.from('project_info').select('value').eq('project','batidoc').eq('key','deliverables').maybeSingle();
    if(!error&&data&&data.value){
      var arr=JSON.parse(data.value);
      if(Array.isArray(arr)&&arr.length){deliverables=arr;renderDeliverables();}
    }
  }catch(e){console.error('loadDeliv',e);}
}

async function saveVisaStatuses(){
  try{
    await sb.from('project_info').delete().eq('project','batidoc').eq('key','visa_statuses');
    await sb.from('project_info').insert({project:'batidoc',key:'visa_statuses',value:JSON.stringify(_visaStatuses),updated_at:new Date().toISOString()});
  }catch(e){console.error('saveVisaStatuses',e);}
}
async function loadVisaStatuses(){
  try{
    var {data,error}=await sb.from('project_info').select('value').eq('project','batidoc').eq('key','visa_statuses').maybeSingle();
    if(!error&&data&&data.value){_visaStatuses=JSON.parse(data.value)||{};}
  }catch(e){console.error('loadVisaStatuses',e);}
}

// ── app init ──────────────────────────────────────────────────
function initApp(){
  setPage('deliverables');
  loadDeliv();
  loadGedWorkflows();
  loadVisaStatuses();
}

function setUserName(name){
  var el=document.getElementById('user-chip');
  if(el) el.textContent=name;
}

// ── screen manager ────────────────────────────────────────────
function showScreen(id){
  document.querySelectorAll('.screen').forEach(function(el){el.style.display='none';el.classList.remove('active');});
  var s=document.getElementById(id);
  if(s){s.style.display='flex';s.classList.add('active');}
}

function goProjects(){
  showScreen('project-screen');
  // Lock non-allowed project cards based on batimon access
  var allowed = window._allowedProjects;
  if(Array.isArray(allowed)){
    document.querySelectorAll('[data-project-id]').forEach(function(card){
      var pid = card.getAttribute('data-project-id');
      if(!allowed.includes(pid)){
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.4';
        card.style.cursor = 'not-allowed';
      }
    });
  }
}

function openProject(id){
  // Enforce project access from batimon
  var allowed = window._allowedProjects;
  if(Array.isArray(allowed) && !allowed.includes(id)){
    return; // silently block
  }
  showScreen('main-screen');
  setPage('deliverables');
  loadDeliv();
}

// ── sidebar ───────────────────────────────────────────────────
var currentPage='deliverables';
function setPage(page){
  currentPage=page;
  document.getElementById('page-deliverables').style.display=page==='deliverables'?'block':'none';
  document.getElementById('page-payments').style.display=page==='payments'?'block':'none';
  document.getElementById('page-workflow').style.display=page==='workflow'?'block':'none';
  document.getElementById('page-contacts').style.display=page==='contacts'?'block':'none';
  document.getElementById('nav-deliverables').classList.toggle('active',page==='deliverables');
  document.getElementById('nav-payments').classList.toggle('active',page==='payments');
  document.getElementById('nav-workflow').classList.toggle('active',page==='workflow');
  document.getElementById('nav-contacts').classList.toggle('active',page==='contacts');
  if(page==='payments') renderPayFolders();
  if(page==='workflow'){loadGedWorkflows().then(renderWorkflows);loadWorkflowInstances();}
  if(page==='contacts') loadContacts();
}

// ── Contacts ──────────────────────────────────────────────────
var _allContacts=[];
var _editingContactId=null;
var _contactSortCol='name';
var _contactSortAsc=true;

async function loadContacts(){
  var list=document.getElementById('contacts-list');
  if(!list)return;
  list.innerHTML='<div style="padding:24px;text-align:center;color:#8099b0;font-size:12px;">Loading…</div>';
  var {data,error}=await sb.from('ged_contacts').select('*').order('name');
  if(error){list.innerHTML='<div style="padding:24px;text-align:center;color:#c02020;font-size:12px;">Error loading contacts</div>';return;}
  _allContacts=data||[];
  updateSortIcons();
  renderContacts(getFilteredSortedContacts());
}

function renderContacts(contacts){
  var list=document.getElementById('contacts-list');
  if(!list)return;
  if(contacts.length===0){
    list.innerHTML='<div style="text-align:center;padding:48px 24px;color:#8099b0;">'+
      '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c0cfe0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'+
      '<div style="font-size:13px;font-weight:600;color:#b0bec5;margin-bottom:4px;">No contacts yet</div>'+
      '<div style="font-size:12px;">Click "New Contact" to add your first one</div></div>';
    return;
  }
  list.innerHTML=contacts.map(function(c,i){
    var bg=i%2===0?'#fff':'#fafcff';
    return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 80px;align-items:center;padding:0 16px;height:46px;background:'+bg+';border-bottom:1px solid rgba(34,79,147,0.05);" onmouseover="this.style.background=\'#eef4ff\'" onmouseout="this.style.background=\''+bg+'\'">'+
      '<div style="font-size:12px;font-weight:600;color:#1a2a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(c.name)+'</div>'+
      '<div style="font-size:12px;color:#4a6080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(c.company||'—')+'</div>'+
      '<div style="font-size:12px;color:#4a6080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+
        (c.email?'<a href="mailto:'+escHtml(c.email)+'" style="color:#224F93;text-decoration:none;">'+escHtml(c.email)+'</a>':'—')+
      '</div>'+
      '<div style="font-size:12px;color:#4a6080;">'+escHtml(c.phone||'—')+'</div>'+
      '<div style="display:flex;gap:5px;justify-content:flex-end;">'+
        '<button onclick="openEditContactModal(\''+c.id+'\')" style="width:28px;height:28px;background:#f0f4f9;border:1px solid rgba(34,79,147,0.15);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Edit">'+
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a6080" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
        '</button>'+
        '<button onclick="deleteContact(\''+c.id+'\')" style="width:28px;height:28px;background:#fff5f5;border:1px solid rgba(192,32,32,0.2);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Delete">'+
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c02020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'+
        '</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function sortContacts(col){
  if(_contactSortCol===col){_contactSortAsc=!_contactSortAsc;}
  else{_contactSortCol=col;_contactSortAsc=true;}
  updateSortIcons();
  filterContacts();
}

function updateSortIcons(){
  ['name','company','email','phone'].forEach(function(c){
    var el=document.getElementById('sort-icon-'+c);
    if(!el)return;
    if(c===_contactSortCol){el.textContent=_contactSortAsc?' ▲':' ▼';el.style.opacity='1';}
    else{el.textContent='';el.style.opacity='0.5';}
  });
}

function getFilteredSortedContacts(){
  var q=(document.getElementById('contacts-search').value||'').toLowerCase();
  var filtered=_allContacts.filter(function(c){
    return (c.name||'').toLowerCase().includes(q)||
           (c.company||'').toLowerCase().includes(q)||
           (c.email||'').toLowerCase().includes(q)||
           (c.phone||'').toLowerCase().includes(q);
  });
  filtered.sort(function(a,b){
    var va=(a[_contactSortCol]||'').toLowerCase();
    var vb=(b[_contactSortCol]||'').toLowerCase();
    if(va<vb)return _contactSortAsc?-1:1;
    if(va>vb)return _contactSortAsc?1:-1;
    return 0;
  });
  return filtered;
}

function filterContacts(){
  renderContacts(getFilteredSortedContacts());
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function openNewContactModal(){
  _editingContactId=null;
  document.getElementById('contact-modal-title').textContent='New Contact';
  document.getElementById('ct-name').value='';
  document.getElementById('ct-company').value='';
  document.getElementById('ct-email').value='';
  document.getElementById('ct-phone').value='';
  document.getElementById('contact-modal').style.display='flex';
  setTimeout(function(){document.getElementById('ct-name').focus();},100);
}

function openEditContactModal(id){
  var c=_allContacts.find(function(x){return x.id===id;});
  if(!c)return;
  _editingContactId=id;
  document.getElementById('contact-modal-title').textContent='Edit Contact';
  document.getElementById('ct-name').value=c.name||'';
  document.getElementById('ct-company').value=c.company||'';
  document.getElementById('ct-email').value=c.email||'';
  document.getElementById('ct-phone').value=c.phone||'';
  document.getElementById('contact-modal').style.display='flex';
  setTimeout(function(){document.getElementById('ct-name').focus();},100);
}

function closeContactModal(){document.getElementById('contact-modal').style.display='none';}

async function saveContact(){
  var name=document.getElementById('ct-name').value.trim();
  if(!name){showToast('Please enter a name');return;}
  var payload={
    name:name,
    company:document.getElementById('ct-company').value.trim()||null,
    email:document.getElementById('ct-email').value.trim()||null,
    phone:document.getElementById('ct-phone').value.trim()||null,
    created_by:(sbProfile&&(sbProfile.username||sbProfile.full_name))||''
  };
  var error;
  if(_editingContactId){
    ({error}=await sb.from('ged_contacts').update(payload).eq('id',_editingContactId));
  }else{
    ({error}=await sb.from('ged_contacts').insert(payload));
  }
  if(error){showToast('Error saving contact');return;}
  closeContactModal();
  showToast((_editingContactId?'Contact updated':'Contact added')+': '+name);
  loadContacts();
}

async function deleteContact(id){
  var c=_allContacts.find(function(x){return x.id===id;});
  if(!c)return;
  if(!confirm('Delete contact "'+c.name+'"?'))return;
  var {error}=await sb.from('ged_contacts').delete().eq('id',id);
  if(error){showToast('Error deleting contact');return;}
  showToast('Contact deleted');
  loadContacts();
}

// ── Workflow Templates ────────────────────────────────────────
var gedWorkflows=[];
var _editingWfId=null;
var _wfPickerContext=null;
var _wfType='approval';
var _wfRouting='series'; // 'series' | 'parallel' | 'custom'

async function loadGedWorkflows(){
  try{
    var {data,error}=await sb.from('ged_workflows').select('*').order('created_at');
    if(!error&&data){gedWorkflows=data;}
  }catch(e){console.error('loadGedWorkflows',e);}
}

function selectDocType(type){
  _wfType=type;
  var appr=document.getElementById('wf-type-approval');
  var sign=document.getElementById('wf-type-signature');
  if(appr){
    appr.style.background=type==='approval'?'#224F93':'#fff';
    appr.style.color=type==='approval'?'#fff':'#8099b0';
    appr.style.border=type==='approval'?'2px solid #224F93':'2px solid rgba(34,79,147,0.2)';
  }
  if(sign){
    sign.style.background=type==='signature'?'#224F93':'#fff';
    sign.style.color=type==='signature'?'#fff':'#8099b0';
    sign.style.border=type==='signature'?'2px solid #224F93':'2px solid rgba(34,79,147,0.2)';
  }
  // Refresh action dropdowns already on screen
  var firstVal=type==='signature'?'signature':'approval';
  var firstText=type==='signature'?'Signature':'Approval';
  document.querySelectorAll('.wf-action-select').forEach(function(s){
    var firstOpt=s.options[0];
    if(firstOpt&&(firstOpt.value==='approval'||firstOpt.value==='signature')){
      var wasFirst=s.value===firstOpt.value;
      firstOpt.value=firstVal;firstOpt.text=firstText;
      if(wasFirst) s.value=firstVal;
    }
  });
}

function selectWfRouting(mode){
  _wfRouting=mode;
  var hints={series:'Each person is notified after the previous one completes.',parallel:'All people are notified at the same time.',custom:'Define groups — each group runs in series, members within a group can be series or parallel.'};
  document.getElementById('wf-route-hint').textContent=hints[mode];
  ['series','parallel','custom'].forEach(function(m){
    var btn=document.getElementById('wf-route-'+m);
    if(m===mode){btn.style.background='#224F93';btn.style.color='#fff';}
    else{btn.style.background='transparent';btn.style.color='#8099b0';}
  });
  document.getElementById('wf-steps-simple').style.display=mode==='custom'?'none':'block';
  document.getElementById('wf-steps-custom').style.display=mode==='custom'?'block':'none';
}

function renderWorkflows(){
  var list=document.getElementById('workflow-list');
  if(!list)return;
  if(gedWorkflows.length===0){
    list.innerHTML='<div style="text-align:center;padding:56px 24px;color:#8099b0;">'+
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c0cfe0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 14px;display:block;"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><line x1="7" y1="11.5" x2="17" y2="6.5"/><line x1="7" y1="12.5" x2="17" y2="17.5"/></svg>'+
      '<div style="font-size:13px;font-weight:600;color:#b0bec5;margin-bottom:6px;">No workflows yet</div>'+
      '<div style="font-size:12px;">Click "New Workflow" to create your first template</div></div>';
    return;
  }
  var typeLabel={'approval':'Document Approval','signature':'Document Signature'};
  var typeColor={'approval':'#1a9458','signature':'#224F93'};
  var typeBg={'approval':'rgba(46,194,126,0.08)','signature':'rgba(34,79,147,0.08)'};
  var routeLabel={'series':'↓ Series','parallel':'⇉ Parallel','custom':'⊞ Custom'};

  var actionColors={approval:'#1a9458',review:'#224F93',info:'#8099b0'};
  var actionLabels={approval:'Approval',review:'Review',info:'For Info'};

  function stepBlock(s,sep){
    if(!s||!s.company)return '';
    var recs=(s.recipients||[]).map(function(r){
      return '<span style="display:inline-flex;align-items:center;gap:3px;background:#fff;border:1px solid rgba(34,79,147,0.12);border-radius:5px;padding:2px 7px;font-size:11px;color:#4a6080;">'+
        escHtml(r.name)+
        '<span style="font-size:10px;font-weight:700;color:'+actionColors[r.action||'approval']+';">&nbsp;'+actionLabels[r.action||'approval']+'</span>'+
      '</span>';
    }).join(sep);
    return '<div style="display:inline-flex;flex-direction:column;gap:4px;">'+
      '<span style="font-size:9px;font-weight:700;color:#8099b0;text-transform:uppercase;letter-spacing:0.06em;">'+escHtml(s.company)+'</span>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+recs+'</div>'+
    '</div>';
  }

  list.innerHTML=gedWorkflows.map(function(wf){
    var t=wf.type||'approval';
    var r=wf.routing||'series';
    var flowHtml='';
    var parallelSep=' <span style="color:#b0bec5;font-size:11px;margin:0 2px;">⇉</span> ';
    var seriesSep=' <span style="color:#b0bec5;margin:0 4px;">→</span> ';
    if(r==='custom'&&wf.groups){
      flowHtml=wf.groups.map(function(g,gi){
        var gSep=g.routing==='parallel'?parallelSep:seriesSep;
        var members=(g.steps||[]).map(function(s){return stepBlock(s,parallelSep);}).join(gSep);
        return (gi>0?'<span style="color:#b0bec5;margin:0 8px;font-size:14px;align-self:center;">▶</span>':'')+
          '<div style="display:inline-flex;flex-direction:column;gap:4px;background:#fff;border:1px solid rgba(34,79,147,0.15);border-radius:8px;padding:7px 10px;">'+
            '<span style="font-size:9px;font-weight:700;color:#8099b0;text-transform:uppercase;">Group '+(gi+1)+' · '+(g.routing==='parallel'?'Parallel':'Series')+'</span>'+
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">'+members+'</div>'+
          '</div>';
      }).join('');
    }else{
      var sep=r==='parallel'?parallelSep:seriesSep;
      flowHtml=(wf.steps||[]).map(function(s){return stepBlock(s,parallelSep);}).join(sep);
    }
    return '<div style="background:#fff;border:1px solid rgba(34,79,147,0.12);border-radius:10px;padding:16px 18px;margin-bottom:10px;">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'+
        '<div style="font-size:13px;font-weight:700;color:#1a2a3a;">'+wf.name+'</div>'+
        '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+typeBg[t]+';color:'+typeColor[t]+';">'+typeLabel[t]+'</span>'+
        '<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#f0f4f9;color:#4a6080;">'+routeLabel[r]+'</span>'+
        '<div style="margin-left:auto;display:flex;gap:6px;">'+
          '<button onclick="openEditWorkflowModal(\''+wf.id+'\')" style="padding:5px 11px;background:#f0f4f9;border:1px solid rgba(34,79,147,0.15);border-radius:6px;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;color:#4a6080;">Edit</button>'+
          '<button onclick="deleteWorkflow(\''+wf.id+'\')" style="padding:5px 11px;background:#fff5f5;border:1px solid rgba(192,32,32,0.2);border-radius:6px;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;color:#c02020;">Delete</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">'+flowHtml+'</div>'+
    '</div>';
  }).join('');
}

async function loadWorkflowInstances(){
  var el=document.getElementById('workflow-instances-list');
  if(!el)return;
  el.innerHTML='<p style="font-size:12px;color:#8099b0;">Loading…</p>';
  var {data:instances,error}=await sb.from('ged_workflow_instances').select('*').order('applied_at',{ascending:false}).limit(20);
  if(error||!instances||instances.length===0){el.innerHTML='<p style="font-size:12px;color:#8099b0;">No workflows sent yet.</p>';return;}

  var statusColors={pending:'#f59e0b',completed:'#1a9458',approved:'#1a9458',signed:'#7c3aed',noted:'#224F93',rejected:'#e53e3e'};
  var statusLabels={pending:'In Progress',completed:'Completed',approved:'Approved',signed:'Signed',noted:'Acknowledged',rejected:'Rejected'};
  var recipStatusColors={pending:'#8099b0',approved:'#1a9458',rejected:'#e53e3e',noted:'#224F93'};
  var recipStatusLabels={pending:'Pending',approved:'Approved',rejected:'Rejected',noted:'Acknowledged'};

  // Load all recipients for these instances
  var ids=instances.map(function(i){return i.id;});
  var {data:allRecips}=await sb.from('ged_workflow_recipients').select('*').in('instance_id',ids);

  el.innerHTML=instances.map(function(inst){
    var recips=(allRecips||[]).filter(function(r){return r.instance_id===inst.id;});
    var statusColor=statusColors[inst.status]||'#8099b0';
    var statusLabel=statusLabels[inst.status]||inst.status;
    var date=inst.applied_at?new Date(inst.applied_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'';
    var recipHtml=recips.map(function(r){
      var sc=recipStatusColors[r.status]||'#8099b0';
      var sl=recipStatusLabels[r.status]||r.status;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:#fff;border:1px solid rgba(34,79,147,0.08);border-radius:7px;">'+
        '<div>'+
          '<div style="font-size:12px;font-weight:600;color:#1a2a3a;">'+escHtml(r.name)+'</div>'+
          '<div style="font-size:10px;color:#8099b0;">'+escHtml(r.company||'')+(r.comment?'<span style="margin-left:6px;color:#4a6080;font-style:italic;">"'+escHtml(r.comment)+'"</span>':'')+'</div>'+
        '</div>'+
        '<span style="font-size:11px;font-weight:700;color:'+sc+';">'+sl+'</span>'+
      '</div>';
    }).join('');
    return '<div style="background:#f8fafd;border:1px solid rgba(34,79,147,0.1);border-radius:10px;overflow:hidden;margin-bottom:12px;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(34,79,147,0.08);">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:700;color:#1a2a3a;">'+escHtml(inst.document_names||'—')+'</div>'+
          '<div style="font-size:11px;color:#8099b0;margin-top:2px;">'+escHtml(inst.workflow_name||'')+(inst.applied_by?' · by '+escHtml(inst.applied_by):'')+(date?' · '+date:'')+'</div>'+
        '</div>'+
        '<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:'+statusColor+'1a;color:'+statusColor+';">'+statusLabel+'</span>'+
      '</div>'+
      '<div style="padding:10px 14px;display:flex;flex-direction:column;gap:6px;">'+
        (recipHtml||'<p style="font-size:12px;color:#8099b0;margin:0;">No recipients found.</p>')+
      '</div>'+
    '</div>';
  }).join('');
}

async function openNewWorkflowModal(){
  _editingWfId=null;
  if(_allContacts.length===0){var {data}=await sb.from('ged_contacts').select('*').order('name');_allContacts=data||[];}
  document.getElementById('wf-modal-title').textContent='New Workflow';
  document.getElementById('wf-name-input').value='';
  document.getElementById('wf-steps-list').innerHTML='';
  document.getElementById('wf-groups-list').innerHTML='';
  selectDocType('approval');
  selectWfRouting('series');
  addWorkflowStep();
  document.getElementById('new-workflow-modal').style.display='flex';
}

async function openEditWorkflowModal(id){
  var wf=gedWorkflows.find(function(w){return w.id===id;});
  if(!wf)return;
  if(_allContacts.length===0){var {data}=await sb.from('ged_contacts').select('*').order('name');_allContacts=data||[];}
  _editingWfId=id;
  document.getElementById('wf-modal-title').textContent='Edit Workflow';
  document.getElementById('wf-name-input').value=wf.name;
  document.getElementById('wf-steps-list').innerHTML='';
  document.getElementById('wf-groups-list').innerHTML='';
  selectDocType(wf.type||'approval');
  selectWfRouting(wf.routing||'series');
  if(wf.routing==='custom'){(wf.groups||[]).forEach(function(g){addWorkflowGroup(g);});}
  else{(wf.steps||[]).forEach(function(s){addWorkflowStep(s);});}
  document.getElementById('new-workflow-modal').style.display='flex';
}

function closeNewWorkflowModal(){document.getElementById('new-workflow-modal').style.display='none';}

function buildCompanyOptions(selected){
  var seen={};var cos=[];
  _allContacts.forEach(function(c){if(c.company&&!seen[c.company]){seen[c.company]=1;cos.push(c.company);}});
  cos.sort();
  return '<option value="">Select a company…</option>'+cos.map(function(co){return '<option value="'+escHtml(co)+'"'+(co===selected?' selected':'')+'>'+escHtml(co)+'</option>';}).join('');
}

function loadStepEmployees(selectEl,preSelected){
  var company=selectEl.value;
  var card=selectEl.closest('.wf-step-card')||selectEl.closest('.wf-member-card');
  var empList=card.querySelector('.wf-employees-list');
  if(!company){empList.innerHTML='';empList.style.display='none';return;}
  var employees=_allContacts.filter(function(c){return c.company===company;});
  if(employees.length===0){empList.innerHTML='<div style="font-size:11px;color:#8099b0;padding:6px 0;">No contacts found for this company.</div>';empList.style.display='block';return;}
  empList.innerHTML=employees.map(function(emp){
    var preRec=preSelected&&preSelected.find(function(r){return r.email===emp.email||r.name===emp.name;});
    var checked=preSelected?(preRec?'checked':''):'checked';
    var action=preRec?preRec.action:'approval';
    return '<div class="wf-emp-row" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border:1px solid rgba(34,79,147,0.08);border-radius:6px;">'+
      '<input type="checkbox" class="wf-emp-check" '+checked+' data-name="'+escHtml(emp.name)+'" data-email="'+escHtml(emp.email||'')+'" style="accent-color:#224F93;width:14px;height:14px;cursor:pointer;flex-shrink:0;">'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:12px;font-weight:600;color:#1a2a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(emp.name)+'</div>'+
        (emp.email?'<div style="font-size:10px;color:#8099b0;">'+escHtml(emp.email)+'</div>':'')+
      '</div>'+
      '<select class="wf-action-select" style="padding:4px 8px;border:1px solid rgba(34,79,147,0.2);border-radius:6px;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;color:#224F93;outline:none;background:#f0f4f9;cursor:pointer;flex-shrink:0;">'+
        (_wfType==='signature'
          ? '<option value="signature"'+(action==='signature'?' selected':'')+'>Signature</option>'
          : '<option value="approval"'+(action==='approval'?' selected':'')+'>Approval</option>')+
        '<option value="review"'+(action==='review'?' selected':'')+'>Review</option>'+
        '<option value="info"'+(action==='info'?' selected':'')+'>For Info</option>'+
      '</select>'+
    '</div>';
  }).join('');
  empList.style.display='block';
}

function addWorkflowStep(value){
  var list=document.getElementById('wf-steps-list');
  var idx=list.children.length+1;
  var company=value&&value.company?value.company:'';
  var div=document.createElement('div');
  div.className='wf-step-card';
  div.style.cssText='background:#f8fafd;border:1px solid rgba(34,79,147,0.12);border-radius:9px;overflow:hidden;';
  div.innerHTML=
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;">'+
      '<div class="wf-step-num" style="width:22px;height:22px;background:#224F93;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;">'+idx+'</div>'+
      '<select class="wf-company-select" onchange="loadStepEmployees(this)" style="flex:1;padding:7px 10px;border:1px solid rgba(34,79,147,0.2);border-radius:7px;font-family:\'Barlow\',sans-serif;font-size:12px;color:#1a2a3a;outline:none;background:#fff;cursor:pointer;">'+
        buildCompanyOptions(company)+
      '</select>'+
      '<button onclick="removeWorkflowStep(this)" style="width:26px;height:26px;flex-shrink:0;background:#fff5f5;border:1px solid rgba(192,32,32,0.2);border-radius:6px;cursor:pointer;color:#c02020;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>'+
    '</div>'+
    '<div class="wf-employees-list" style="display:none;padding:0 12px 10px 44px;display:flex;flex-direction:column;gap:5px;"></div>';
  list.appendChild(div);
  if(company&&value&&value.recipients){loadStepEmployees(div.querySelector('.wf-company-select'),value.recipients);}
  renumberWorkflowSteps();
}

function removeWorkflowStep(btn){btn.closest('.wf-step-card').remove();renumberWorkflowSteps();}

function renumberWorkflowSteps(){
  var items=document.querySelectorAll('#wf-steps-list > .wf-step-card');
  items.forEach(function(item,i){var b=item.querySelector('.wf-step-num');if(b)b.textContent=i+1;});
}

// ── Custom groups ─────────────────────────────────────────────
function addWorkflowGroup(groupData){
  var list=document.getElementById('wf-groups-list');
  var idx=list.children.length+1;
  var gRouting=(groupData&&groupData.routing)||'series';
  var div=document.createElement('div');
  div.className='wf-group-card';
  div.style.cssText='border:1px solid rgba(34,79,147,0.18);border-radius:10px;overflow:hidden;';
  div.innerHTML=
    '<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#f0f4f9;border-bottom:1px solid rgba(34,79,147,0.1);">'+
      '<span class="wf-group-num" style="font-size:11px;font-weight:700;color:#224F93;">Group '+idx+'</span>'+
      '<div style="display:flex;background:#fff;border:1px solid rgba(34,79,147,0.2);border-radius:6px;overflow:hidden;margin-left:4px;">'+
        '<button class="wf-grp-btn-series" onclick="setGroupRouting(this,\'series\')" style="padding:3px 10px;border:none;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;background:'+(gRouting==='series'?'#224F93':'transparent')+';color:'+(gRouting==='series'?'#fff':'#8099b0')+';">Series</button>'+
        '<button class="wf-grp-btn-parallel" onclick="setGroupRouting(this,\'parallel\')" style="padding:3px 10px;border:none;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;background:'+(gRouting==='parallel'?'#224F93':'transparent')+';color:'+(gRouting==='parallel'?'#fff':'#8099b0')+';">Parallel</button>'+
      '</div>'+
      '<button onclick="removeWorkflowGroup(this)" style="margin-left:auto;width:22px;height:22px;background:#fff5f5;border:1px solid rgba(192,32,32,0.2);border-radius:5px;cursor:pointer;color:#c02020;font-size:12px;display:flex;align-items:center;justify-content:center;">✕</button>'+
    '</div>'+
    '<div class="wf-group-members" style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;"></div>'+
    '<div style="padding:6px 12px 10px;">'+
      '<button onclick="addGroupMember(this.closest(\'.wf-group-card\'))" style="display:flex;align-items:center;gap:5px;padding:5px 10px;background:#f0f4f9;border:1px solid rgba(34,79,147,0.15);border-radius:6px;font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;cursor:pointer;color:#224F93;">'+
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
        'Add Member'+
      '</button>'+
    '</div>';
  list.appendChild(div);
  // add existing members
  if(groupData&&groupData.steps) groupData.steps.forEach(function(s){addGroupMember(div,s);});
  else addGroupMember(div);
  renumberGroups();
}

function setGroupRouting(btn,mode){
  var card=btn.closest('.wf-group-card');
  card.querySelector('.wf-grp-btn-series').style.background=mode==='series'?'#224F93':'transparent';
  card.querySelector('.wf-grp-btn-series').style.color=mode==='series'?'#fff':'#8099b0';
  card.querySelector('.wf-grp-btn-parallel').style.background=mode==='parallel'?'#224F93':'transparent';
  card.querySelector('.wf-grp-btn-parallel').style.color=mode==='parallel'?'#fff':'#8099b0';
}

function removeWorkflowGroup(btn){btn.closest('.wf-group-card').remove();renumberGroups();}

function renumberGroups(){
  var items=document.querySelectorAll('#wf-groups-list > .wf-group-card');
  items.forEach(function(item,i){var b=item.querySelector('.wf-group-num');if(b)b.textContent='Group '+(i+1);});
}

function addGroupMember(groupCard,value){
  var membersDiv=groupCard.querySelector('.wf-group-members');
  var company=value&&value.company?value.company:'';
  var div=document.createElement('div');
  div.className='wf-member-card';
  div.style.cssText='background:#f8fafd;border:1px solid rgba(34,79,147,0.1);border-radius:8px;overflow:hidden;';
  div.innerHTML=
    '<div style="display:flex;align-items:center;gap:7px;padding:8px 10px;">'+
      '<select class="wf-company-select" onchange="loadStepEmployees(this)" style="flex:1;padding:6px 9px;border:1px solid rgba(34,79,147,0.2);border-radius:6px;font-family:\'Barlow\',sans-serif;font-size:12px;color:#1a2a3a;outline:none;background:#fff;cursor:pointer;">'+
        buildCompanyOptions(company)+
      '</select>'+
      '<button onclick="this.closest(\'.wf-member-card\').remove()" style="width:24px;height:24px;flex-shrink:0;background:#fff5f5;border:1px solid rgba(192,32,32,0.2);border-radius:5px;cursor:pointer;color:#c02020;font-size:12px;display:flex;align-items:center;justify-content:center;">✕</button>'+
    '</div>'+
    '<div class="wf-employees-list" style="display:none;padding:0 10px 8px 10px;display:flex;flex-direction:column;gap:5px;"></div>';
  membersDiv.appendChild(div);
  if(company&&value&&value.recipients){loadStepEmployees(div.querySelector('.wf-company-select'),value.recipients);}
}

function collectStepRecipients(card){
  var company=card.querySelector('.wf-company-select').value;
  if(!company)return null;
  var recipients=[];
  card.querySelectorAll('.wf-emp-row').forEach(function(row){
    var check=row.querySelector('.wf-emp-check');
    if(check&&check.checked) recipients.push({name:check.dataset.name,email:check.dataset.email,action:row.querySelector('.wf-action-select').value});
  });
  return recipients.length>0?{company:company,recipients:recipients}:null;
}

async function saveWorkflow(){
  var name=document.getElementById('wf-name-input').value.trim();
  if(!name){showToast('Please enter a workflow name');return;}
  var wfData={name:name,type:_wfType,routing:_wfRouting};
  if(_wfRouting==='custom'){
    var groups=[];
    document.querySelectorAll('#wf-groups-list > .wf-group-card').forEach(function(card){
      var seriesBtn=card.querySelector('.wf-grp-btn-series');
      var gRouting=seriesBtn&&seriesBtn.style.background.includes('34')?'series':'parallel';
      var steps=[];
      card.querySelectorAll('.wf-member-card').forEach(function(mc){var s=collectStepRecipients(mc);if(s)steps.push(s);});
      if(steps.length>0)groups.push({routing:gRouting,steps:steps});
    });
    if(groups.length<1){showToast('Please add at least one group with a company selected');return;}
    wfData.groups=groups;
  }else{
    var steps=[];
    document.querySelectorAll('#wf-steps-list > .wf-step-card').forEach(function(card){var s=collectStepRecipients(card);if(s)steps.push(s);});
    if(steps.length<1){showToast('Please select at least one company and recipient');return;}
    wfData.steps=steps;
  }
  if(_editingWfId){
    wfData.id=_editingWfId;
  }else{
    wfData.id=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'_'+Math.random().toString(36).slice(2));
  }
  var {error}=await sb.from('ged_workflows').upsert(wfData);
  if(error){showToast('Error saving workflow');console.error(error);return;}
  await loadGedWorkflows();
  closeNewWorkflowModal();renderWorkflows();
  showToast((_editingWfId?'Workflow updated':'Workflow created')+': '+name);
}

async function deleteWorkflow(id){
  var wf=gedWorkflows.find(function(w){return w.id===id;});
  if(!wf)return;
  if(!confirm('Delete workflow "'+wf.name+'"?'))return;
  var {error}=await sb.from('ged_workflows').delete().eq('id',id);
  if(error){showToast('Error deleting workflow');console.error(error);return;}
  await loadGedWorkflows();
  renderWorkflows();
  showToast('Workflow deleted');
}

// ── Workflow Picker (toolbar button) ─────────────────────────
async function openWfPicker(names){
  _wfPickerContext=names;
  document.getElementById('wf-picker-subtitle').textContent=names;
  var list=document.getElementById('wf-picker-list');
  list.innerHTML='<div style="text-align:center;padding:24px;color:#8099b0;font-size:12px;">Loading…</div>';
  document.getElementById('wf-picker-modal').style.display='flex';
  await loadGedWorkflows();
  if(gedWorkflows.length===0){
    list.innerHTML='<div style="text-align:center;padding:24px;color:#8099b0;font-size:12px;">No workflows yet.<br>Click <b>+ Manage Workflows</b> below to create one.</div>';
  }else{
    list.innerHTML=gedWorkflows.map(function(wf){
      var stepsHtml=wf.steps.map(function(s,i){
        return (i>0?'<span style="color:#b0bec5;margin:0 3px;font-size:12px;">→</span>':'')+
          '<span style="font-size:10px;color:#4a6080;">'+s+'</span>';
      }).join('');
      return '<div onclick="applyWfTemplate(\''+wf.id+'\')" style="border:1px solid rgba(34,79,147,0.15);border-radius:9px;padding:13px 16px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'#f0f4f9\'" onmouseout="this.style.background=\'#fff\'">'+
        '<div style="font-size:13px;font-weight:700;color:#1a2a3a;margin-bottom:6px;">'+wf.name+'</div>'+
        '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;">'+stepsHtml+'</div>'+
      '</div>';
    }).join('');
  }
}

function closeWfPicker(){document.getElementById('wf-picker-modal').style.display='none';}

async function applyWfTemplate(id){
  var wf=gedWorkflows.find(function(w){return w.id===id;});
  if(!wf)return;
  closeWfPicker();
  showToast('Sending notifications…');
  await sendWorkflowEmails(wf,_wfPickerContext);
}

async function sendWorkflowEmails(wf,itemNames){
  var actionLabels={approval:'Approval',signature:'Signature',review:'Review',info:'For Information'};
  var actionColors={approval:'#1a9458',signature:'#7c3aed',review:'#224F93',info:'#8099b0'};
  var typeLabel=wf.type==='signature'?'Document Signature':'Document Approval';
  var sender='BatiGED <ged@batimon.com>';
  var senderName=(sbProfile&&(sbProfile.full_name||sbProfile.username))||'BatiGED';

  // Collect all recipients flat
  var recipients=[];
  if(wf.routing==='custom'){
    (wf.groups||[]).forEach(function(g,gi){
      (g.steps||[]).forEach(function(s){
        (s.recipients||[]).forEach(function(r){
          if(r.email) recipients.push({name:r.name,email:r.email,action:r.action||'approval',step:gi+1,company:s.company});
        });
      });
    });
  }else{
    (wf.steps||[]).forEach(function(s,si){
      (s.recipients||[]).forEach(function(r){
        if(r.email) recipients.push({name:r.name,email:r.email,action:r.action||'approval',step:si+1,company:s.company});
      });
    });
  }
  if(recipients.length===0){showToast('No email addresses found in this workflow');return;}

  // Create workflow instance in DB
  var {data:instance,error:instErr}=await sb.from('ged_workflow_instances').insert({
    workflow_id:wf.id,workflow_name:wf.name,workflow_type:wf.type||'approval',
    document_names:itemNames||'',applied_by:senderName,status:'pending'
  }).select().single();
  if(instErr){console.error(instErr);}

  // Create recipient records with tokens
  var recipRows=recipients.map(function(r){
    return {instance_id:instance?instance.id:null,name:r.name,email:r.email,
      action:r.action,company:r.company||'',step_index:r.step,status:'pending'};
  });
  var {data:savedRecips}=await sb.from('ged_workflow_recipients').insert(recipRows).select();

  var sent=0;var failed=0;
  for(var i=0;i<recipients.length;i++){
    var r=recipients[i];
    var saved=savedRecips&&savedRecips[i];
    var token=saved?saved.token:null;
    var respondUrl=token?'https://ged.batimon.com/review?token='+token:null;
    var actionLabel=actionLabels[r.action]||'Approval';
    var actionColor=actionColors[r.action]||'#224F93';
    var subject='[BatiGED] '+typeLabel+' required — '+actionLabel;
    var html=buildEmailHtml({
      recipientName:r.name,actionLabel:actionLabel,actionColor:actionColor,
      typeLabel:typeLabel,itemNames:itemNames||'',wfName:wf.name,
      company:r.company||'',senderName:senderName,respondUrl:respondUrl
    });
    var ok=await sendResendEmail(r.email,subject,html,sender);
    if(ok)sent++;else failed++;
  }
  if(failed===0) showToast('✓ '+sent+' notification'+(sent>1?'s':'')+' sent successfully');
  else showToast('Sent: '+sent+' · Failed: '+failed);
  loadDeliverablesBadges();
  loadPayFolderBadges();
}

async function sendResendEmail(to,subject,html,from){
  try{
    var res=await fetch('https://batidoc-email.rmabdelsamad01.workers.dev',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({to:to,subject:subject,html:html,from:from})
    });
    return res.ok;
  }catch(e){return false;}
}

function buildEmailHtml(o){
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
  '<body style="margin:0;padding:0;background:#f0f4f9;font-family:Barlow,Arial,sans-serif;">'+
  '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f9;padding:40px 16px;">'+
    '<tr><td align="center">'+
      '<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(34,79,147,0.10);max-width:100%;">'+
        // Header
        '<tr><td style="background:#224F93;padding:28px 36px;text-align:center;">'+
          '<div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:0.04em;">BatiGED</div>'+
          '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">Document Management</div>'+
        '</td></tr>'+
        // Action badge
        '<tr><td style="padding:32px 36px 0;text-align:center;">'+
          '<span style="display:inline-block;background:'+o.actionColor+';color:#fff;font-size:13px;font-weight:700;padding:6px 20px;border-radius:20px;letter-spacing:0.05em;">'+o.actionLabel+' Required</span>'+
        '</td></tr>'+
        // Greeting
        '<tr><td style="padding:24px 36px 0;">'+
          '<p style="margin:0;font-size:15px;font-weight:600;color:#1a2a3a;">Hello '+escHtml(o.recipientName)+',</p>'+
          '<p style="margin:12px 0 0;font-size:14px;color:#4a6080;line-height:1.6;">'+
            'You have been requested to provide your <strong>'+o.actionLabel+'</strong> for the following document(s):'+
          '</p>'+
        '</td></tr>'+
        // Document box
        '<tr><td style="padding:16px 36px 0;">'+
          '<div style="background:#f0f4f9;border:1px solid rgba(34,79,147,0.15);border-radius:9px;padding:14px 18px;">'+
            '<div style="font-size:11px;font-weight:700;color:#8099b0;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">Document(s)</div>'+
            '<div style="font-size:13px;font-weight:600;color:#1a2a3a;">'+escHtml(o.itemNames||'—')+'</div>'+
          '</div>'+
        '</td></tr>'+
        // Workflow info
        '<tr><td style="padding:14px 36px 0;">'+
          '<div style="display:flex;gap:10px;">'+
            '<div style="flex:1;background:#f8fafd;border:1px solid rgba(34,79,147,0.1);border-radius:8px;padding:12px 14px;">'+
              '<div style="font-size:10px;font-weight:700;color:#8099b0;text-transform:uppercase;letter-spacing:0.07em;">Workflow</div>'+
              '<div style="font-size:12px;font-weight:600;color:#1a2a3a;margin-top:3px;">'+escHtml(o.wfName)+'</div>'+
            '</div>'+
            '<div style="flex:1;background:#f8fafd;border:1px solid rgba(34,79,147,0.1);border-radius:8px;padding:12px 14px;">'+
              '<div style="font-size:10px;font-weight:700;color:#8099b0;text-transform:uppercase;letter-spacing:0.07em;">Type</div>'+
              '<div style="font-size:12px;font-weight:600;color:#1a2a3a;margin-top:3px;">'+escHtml(o.typeLabel)+'</div>'+
            '</div>'+
          '</div>'+
        '</td></tr>'+
        // Respond button
        (o.respondUrl?
        '<tr><td style="padding:24px 36px 0;text-align:center;">'+
          '<a href="'+o.respondUrl+'" style="display:inline-block;background:#224F93;color:#fff;font-size:14px;font-weight:700;padding:13px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">'+
            (o.actionLabel==='For Information'?'✓ Acknowledge':'Respond Now')+
          '</a>'+
          '<p style="margin:10px 0 0;font-size:11px;color:#b0bec5;">Click the button above to submit your response</p>'+
        '</td></tr>':'')+
        // Sent by
        '<tr><td style="padding:14px 36px 24px;">'+
          '<p style="margin:0;font-size:13px;color:#8099b0;">Sent by <strong style="color:#4a6080;">'+escHtml(o.senderName)+'</strong> via BatiGED</p>'+
        '</td></tr>'+
        // Footer
        '<tr><td style="background:#f4f8fd;padding:16px 36px;border-top:1px solid rgba(34,79,147,0.08);text-align:center;">'+
          '<p style="margin:0;font-size:11px;color:#b0bec5;">BatiGED &copy; 2025 Batiglobe &mdash; All rights reserved</p>'+
        '</td></tr>'+
      '</table>'+
    '</td></tr>'+
  '</table>'+
  '</body></html>';
}

// ── user dropdown ────────────────────────────────────────────
// (toggleUserDropdown and click-outside are handled by auth.js)

function openMyProfile(){
  document.getElementById('user-dropdown').style.display='none';
  var s=sbProfile||{};
  document.getElementById('profile-name-display').textContent=s.full_name||s.username||'';
  document.getElementById('profile-username-display').textContent=s.username||'';
  document.getElementById('profile-modal').style.display='flex';
}
function closeProfileModal(){document.getElementById('profile-modal').style.display='none';}

function openManageAccount(){
  document.getElementById('user-dropdown').style.display='none';
  var s=sbProfile||{};
  document.getElementById('acc-name').value=s.full_name||'';
  document.getElementById('acc-username').value=s.username||'';
  document.getElementById('acc-pass').value='';
  var phone=s.phone||'';
  var code=s.phone_code||'+212';
  document.getElementById('acc-phone').value=phone;
  var codeEl=document.getElementById('acc-phone-code');
  if(codeEl){
    for(var i=0;i<codeEl.options.length;i++){
      if(codeEl.options[i].value===code){codeEl.selectedIndex=i;break;}
    }
  }
  selectRole(s.role||'Viewer');
  document.getElementById('acc-err').style.display='none';
  document.getElementById('acc-ok').style.display='none';
  document.getElementById('account-modal').style.display='flex';
}
function closeAccountModal(){document.getElementById('account-modal').style.display='none';}

var selectedRole='Viewer';
function selectRole(role){
  selectedRole=role;
  ['Admin','Editor','Viewer'].forEach(function(r){
    var el=document.getElementById('role-'+r.toLowerCase());
    if(!el)return;
    var active=r===role;
    el.style.borderColor=active?'#224F93':'rgba(34,79,147,0.2)';
    el.style.background=active?'rgba(34,79,147,0.06)':'transparent';
    var span=el.querySelector('span');
    if(span) span.style.color=active?'#224F93':'#1a2a3a';
  });
}

function saveAccount(){
  var name=document.getElementById('acc-name').value.trim();
  var pass=document.getElementById('acc-pass').value;
  var phone=document.getElementById('acc-phone').value.trim();
  var phoneCode=document.getElementById('acc-phone-code').value;
  var err=document.getElementById('acc-err');
  var ok=document.getElementById('acc-ok');
  err.style.display='none'; ok.style.display='none';
  if(!name){err.textContent='Full name is required.';err.style.display='block';return;}
  if(!sbProfile){return;}
  sbProfile.full_name=name;
  sbProfile.phone=phone;
  sbProfile.phone_code=phoneCode;
  sbProfile.role=selectedRole;
  updateUserChip(name);
  ok.textContent='Account updated successfully!';
  ok.style.display='block';
  showToast('Account saved');
}

var deliverables=[
  {id:1,code:'PEC-RAP-ESS',name:"Piece Ecrite - Rapport et Rapports d'essais",blue:false,date:'10/03/2026'},
  {id:2,code:'FTC',        name:'Fiche Technique',                             blue:false,date:'10/03/2026'},
  {id:3,code:'ECH',        name:'Fiche Echantillon',                           blue:false,date:'10/03/2026'},
  {id:4,code:'NDC',        name:'Note de Calcul',                             blue:false,date:'10/03/2026'},
  {id:5,code:'PLA',        name:"Plans D'execution, Elevation et Details",    blue:false,date:'10/03/2026'},
  {id:6,code:'',           name:'Rapports Topographiques',                     blue:false,date:'10/03/2026'},
  {id:7,code:'DOE',        name:'DOE (Dossiers Ouvrage Exécutés)',            blue:false,date:'10/03/2026'},
];

function folderSVG(blue, id){
  var c=blue?'#4a90d9':'#90a4ae';
  return '<svg width="18" height="15" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg"'
        +' style="flex-shrink:0;">'
        +'<path fill="'+c+'" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/>'
        +'</svg>';
}

function actionsSVG(){
  var c='#c0ccd8';
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
        +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
}

function renderDeliverables(){
  var list=document.getElementById('deliverables-list');
  if(!list)return;
  list.innerHTML=deliverables.map(function(d,i){
    var dn=d.num||d.id;
    var label=d.code?dn+'. ('+d.code+') '+d.name:dn+'. '+d.name;
    var bg=i%2===0?'#ffffff':'#fafcff';
    return '<div class="del-row" style="background:'+bg+';"'
      +' onmouseover="this.style.background=\'#eef4ff\'"'
      +' onmouseout="this.style.background=\''+bg+'\'">'
      +'<div style="display:flex;align-items:center;justify-content:center;">'
      +'<input type="checkbox" class="row-check" data-id="'+d.id+'" onchange="updateToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;">'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:8px;overflow:hidden;cursor:pointer;" onclick="openFolder('+d.id+')">'
      +folderSVG(d.blue, d.id)
      +'<span style="font-size:12px;color:#1a2a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;">'+label+'</span>'
      +'<span id="wf-badge-'+d.id+'" style="flex-shrink:0;margin-left:4px;"></span>'
      +'</div>'
      +'<div></div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;text-align:right;padding-right:4px;">'+d.date+'</div>'
      +'<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">'+actionsSVG()+'</div>'
      +'</div>';
  }).join('');
  loadDeliverablesBadges();
}

function wfBadgePill(text,color,bg){
  return '<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;background:'+bg+';color:'+color+';border:1px solid '+color+'33;white-space:nowrap;line-height:1.6;">'+text+'</span>';
}

async function loadDeliverablesBadges(){
  var {data:instances}=await sb.from('ged_workflow_instances').select('*').order('applied_at',{ascending:false});
  if(!instances)instances=[];
  var recips=[];
  if(instances.length){
    var ids=instances.map(function(i){return i.id;});
    var {data:r}=await sb.from('ged_workflow_recipients').select('instance_id,status,action').in('instance_id',ids);
    if(r)recips=r;
  }
  deliverables.forEach(function(d){
    var el=document.getElementById('wf-badge-'+d.id);
    if(!el)return;
    var name=d.name.toLowerCase();
    var matching=instances.filter(function(inst){
      return inst.document_names&&inst.document_names.toLowerCase().indexOf(name)!==-1;
    });
    if(matching.length===0){el.innerHTML=wfBadgePill('Not Submitted','#8099b0','#f0f4f9');return;}
    var inst=matching[0];
    var ir=recips.filter(function(r){return r.instance_id===inst.id;});
    var total=ir.length;
    if(inst.status==='pending'){el.innerHTML=wfBadgePill('In Progress','#d97706','#fffbeb');return;}
    var approvedCnt=ir.filter(function(r){return r.status==='approved'||r.status==='noted';}).length;
    var rejectedCnt=ir.filter(function(r){return r.status==='rejected';}).length;
    if(rejectedCnt>0){
      var parts=[];
      if(approvedCnt>0)parts.push(approvedCnt+'/'+total+' Approved');
      parts.push(rejectedCnt+'/'+total+' Rejected');
      el.innerHTML=wfBadgePill(parts.join(' · '),'#e53e3e','#fff5f5');
      return;
    }
    var lbl={approved:'Approved',signed:'Signed',noted:'Acknowledged',completed:'Approved'}[inst.status]||'Approved';
    var col={approved:'#1a9458',signed:'#7c3aed',noted:'#224F93',completed:'#1a9458'}[inst.status]||'#1a9458';
    var bg={approved:'#f0fdf4',signed:'#faf5ff',noted:'#eff6ff',completed:'#f0fdf4'}[inst.status]||'#f0fdf4';
    var txt=total>1?approvedCnt+'/'+total+' '+lbl:lbl;
    el.innerHTML=wfBadgePill(txt,col,bg);
  });
}

function toggleAll(cb){
  document.querySelectorAll('.row-check').forEach(function(c){c.checked=cb.checked;});
  updateToolbar();
}

// ── toolbar state ────────────────────────────────────────────
function updateToolbar(){
  var checked=document.querySelectorAll('.row-check:checked');
  var one=checked.length===1;
  var any=checked.length>0;
  function setBtn(id, enabled){
    var b=document.getElementById(id);
    if(!b)return;
    b.style.opacity=enabled?'1':'0.45';
    b.style.pointerEvents=enabled?'auto':'none';
  }
  setBtn('btn-rename',   one);
  setBtn('btn-duplicate',any);
  setBtn('btn-move',     any);
  setBtn('btn-workflow', any);
  setBtn('btn-status',   one);
  setBtn('btn-download', any);
  setBtn('btn-delete',   any);
}

// ── new folder modal ─────────────────────────────────────────
function openNewFolderModal(){
  document.getElementById('new-folder-input').value='';
  document.getElementById('new-folder-err').style.display='none';
  document.getElementById('new-folder-modal').style.display='flex';
  setTimeout(function(){document.getElementById('new-folder-input').focus();},80);
}
function closeNewFolderModal(){
  document.getElementById('new-folder-modal').style.display='none';
}
function confirmNewFolder(){
  var val=document.getElementById('new-folder-input').value.trim();
  if(!val){document.getElementById('new-folder-err').textContent='Please enter a folder name.';document.getElementById('new-folder-err').style.display='block';return;}
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  var newId=Date.now();
  var newNum=deliverables.length?Math.max.apply(null,deliverables.map(function(d){return d.num||0;}))+1:1;
  deliverables.push({id:newId,num:newNum,code:'',name:val,blue:false,date:ds});
  closeNewFolderModal();
  renderDeliverables();
  saveDeliv();
}

// ── rename modal ─────────────────────────────────────────────
function openRenameModal(){
  var checked=document.querySelectorAll('.row-check:checked');
  if(checked.length!==1)return;
  var rowId=parseInt(checked[0].getAttribute('data-id'));
  var d=deliverables.find(function(x){return x.id===rowId;});
  if(!d)return;
  document.getElementById('rename-input').value=d.name;
  document.getElementById('rename-err').style.display='none';
  document.getElementById('rename-modal').setAttribute('data-id',rowId);
  document.getElementById('rename-modal').style.display='flex';
  setTimeout(function(){document.getElementById('rename-input').focus();},80);
}
function closeRenameModal(){
  document.getElementById('rename-modal').style.display='none';
}
function confirmRename(){
  var val=document.getElementById('rename-input').value.trim();
  if(!val){document.getElementById('rename-err').textContent='Please enter a name.';document.getElementById('rename-err').style.display='block';return;}
  var rawId=document.getElementById('rename-modal').getAttribute('data-id');
  if(rawId&&rawId.indexOf('file:')===0){
    // file rename
    var idx=parseInt(rawId.replace('file:',''));
    var files=folderFiles[currentFolderId]||[];
    if(files[idx]) files[idx].name=val;
    closeRenameModal();
    renderFolderFiles();
  } else {
    // folder rename
    var rowId=parseInt(rawId);
    var d=deliverables.find(function(x){return x.id===rowId;});
    if(d){d.name=val;d.code='';}
    closeRenameModal();
    renderDeliverables();
    saveDeliv();
  }
}

// ── delete ───────────────────────────────────────────────────
function deleteSelected(){
  var checked=document.querySelectorAll('.row-check:checked');
  if(!checked.length)return;
  var ids=Array.from(checked).map(function(c){return parseInt(c.getAttribute('data-id'));});
  var names=ids.map(function(id){var d=deliverables.find(function(x){return x.id===id;});if(!d)return '';var dn=d.num||d.id;return '"'+(d.code?dn+'.('+d.code+') '+d.name:dn+'. '+d.name)+'"';}).join(', ');
  document.getElementById('delete-names').textContent=ids.length===1?names:ids.length+' folders selected';
  document.getElementById('delete-modal').setAttribute('data-ids',JSON.stringify(ids));
  document.getElementById('delete-modal').style.display='flex';
}
function closeDeleteModal(){
  document.getElementById('delete-modal').style.display='none';
}
function confirmDelete(){
  var ids=JSON.parse(document.getElementById('delete-modal').getAttribute('data-ids')||'[]');
  deliverables=deliverables.filter(function(d){return ids.indexOf(d.id)===-1;});
  ids.forEach(function(id){delete folderFiles[id];});
  closeDeleteModal();
  document.getElementById('check-all').checked=false;
  renderDeliverables();
  saveDeliv();
}

// ── duplicate ────────────────────────────────────────────────
function duplicateSelected(){
  var checked=document.querySelectorAll('.row-check:checked');
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  Array.from(checked).forEach(function(cb){
    var id=parseInt(cb.getAttribute('data-id'));
    var d=deliverables.find(function(x){return x.id===id;});
    if(!d)return;
    var newId=Date.now();
    var newNum=Math.max.apply(null,deliverables.map(function(x){return x.num||0;}))+1;
    var copy=Object.assign({},d,{id:newId,num:newNum,name:d.name+' (copy)',date:ds});
    // also duplicate files
    if(folderFiles[id]) folderFiles[newId]=folderFiles[id].slice();
    var idx=deliverables.indexOf(d);
    deliverables.splice(idx+1,0,copy);
  });
  document.getElementById('check-all').checked=false;
  renderDeliverables();
  updateToolbar();
  saveDeliv();
}

// ── download ─────────────────────────────────────────────────
function downloadSelected(){
  var checked=document.querySelectorAll('.row-check:checked');
  var names=Array.from(checked).map(function(cb){
    var id=parseInt(cb.getAttribute('data-id'));
    var d=deliverables.find(function(x){return x.id===id;});
    if(!d)return '';var dn=d.num||d.id;return d.code?dn+'.('+d.code+') '+d.name:dn+'. '+d.name;
  }).filter(Boolean);
  document.getElementById('download-names').innerHTML=names.map(function(n){
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(34,79,147,0.06);">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#90a4ae" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;">'+n+'</span></div>';
  }).join('');
  document.getElementById('download-modal').style.display='flex';
}
function closeDownloadModal(){document.getElementById('download-modal').style.display='none';}
async function confirmDownload(){
  var btn=document.getElementById('download-confirm-btn');
  btn.textContent='Downloading…';btn.style.background='#1a9458';
  await gedDownloadFiles(_downloadFileRefs);
  closeDownloadModal();
  btn.textContent='Download';btn.style.background='#224F93';
  _downloadFileRefs=[];
}

// ── move ─────────────────────────────────────────────────────
function openMoveModal(){
  var checked=document.querySelectorAll('.row-check:checked');
  var names=Array.from(checked).map(function(cb){
    var id=parseInt(cb.getAttribute('data-id'));
    var d=deliverables.find(function(x){return x.id===id;});
    return d?(d.code?'('+d.code+') '+d.name:d.name):'';
  }).filter(Boolean).join(', ');
  document.getElementById('move-item-names').textContent=names;
  document.getElementById('move-dest').value='';
  document.getElementById('move-modal').style.display='flex';
}
function closeMoveModal(){document.getElementById('move-modal').style.display='none';}

function closeStatusModal(){document.getElementById('status-modal').style.display='none';}

function renderStatusInstances(instances,allRecips){
  var statusColors={pending:'#f59e0b',completed:'#1a9458',approved:'#1a9458',signed:'#7c3aed',noted:'#224F93',rejected:'#e53e3e'};
  var statusLabels={pending:'In Progress',completed:'Completed',approved:'Approved',signed:'Signed',noted:'Acknowledged',rejected:'Rejected'};
  var recipStatusColors={pending:'#8099b0',approved:'#1a9458',rejected:'#e53e3e',noted:'#224F93'};
  var recipIcons={pending:'⏳',approved:'✅',rejected:'❌',noted:'✓'};
  return instances.map(function(inst){
    var recips=(allRecips||[]).filter(function(r){return r.instance_id===inst.id;});
    var statusColor=statusColors[inst.status]||'#8099b0';
    var statusLabel=statusLabels[inst.status]||inst.status;
    var date=inst.applied_at?new Date(inst.applied_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    var recipHtml=recips.map(function(r){
      var sc=recipStatusColors[r.status]||'#8099b0';
      var icon=recipIcons[r.status]||'⏳';
      var respondedDate=r.responded_at?new Date(r.responded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1px solid rgba(34,79,147,0.08);border-radius:7px;">'+
        '<span style="font-size:16px;">'+icon+'</span>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:12px;font-weight:600;color:#1a2a3a;">'+escHtml(r.name)+'</div>'+
          '<div style="font-size:10px;color:#8099b0;">'+escHtml(r.company||'')+(r.action?' · '+escHtml(r.action):'')+(respondedDate?' · '+respondedDate:'')+'</div>'+
          (r.comment?'<div style="font-size:11px;color:#4a6080;margin-top:2px;font-style:italic;">"'+escHtml(r.comment)+'"</div>':'')+
        '</div>'+
        '<span style="font-size:11px;font-weight:700;color:'+sc+';">'+escHtml(r.status.charAt(0).toUpperCase()+r.status.slice(1))+'</span>'+
      '</div>';
    }).join('');
    return '<div style="margin-bottom:16px;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'+
        '<div>'+
          '<div style="font-size:12px;font-weight:700;color:#1a2a3a;">'+escHtml(inst.workflow_name||'Workflow')+'</div>'+
          '<div style="font-size:10px;color:#8099b0;">'+escHtml(inst.applied_by||'')+(date?' · '+date:'')+'</div>'+
        '</div>'+
        '<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:'+statusColor+'1a;color:'+statusColor+';">'+statusLabel+'</span>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px;">'+recipHtml+'</div>'+
    '</div>';
  }).join('');
}

async function openStatusModal(){
  var checked=document.querySelectorAll('.row-check:checked');
  if(checked.length!==1)return;
  var id=parseInt(checked[0].getAttribute('data-id'));
  var d=deliverables.find(function(x){return x.id===id;});
  var docName=d?(d.code?'('+d.code+') '+d.name:d.name):'';
  document.getElementById('status-modal-subtitle').textContent=docName;
  document.getElementById('status-modal-body').innerHTML='<p style="font-size:12px;color:#8099b0;">Loading…</p>';
  document.getElementById('status-modal').style.display='flex';
  var {data:instances}=await sb.from('ged_workflow_instances').select('*').ilike('document_names','%'+docName+'%').order('applied_at',{ascending:false});
  if(!instances||instances.length===0){
    document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">No workflow has been applied to this document yet.</p>';
    return;
  }
  var ids=instances.map(function(i){return i.id;});
  var {data:allRecips}=await sb.from('ged_workflow_recipients').select('*').in('instance_id',ids);
  document.getElementById('status-modal-body').innerHTML=renderStatusInstances(instances,allRecips);
}
function confirmMove(){
  var dest=document.getElementById('move-dest').value.trim();
  if(!dest){document.getElementById('move-dest').style.borderColor='#c02020';return;}
  showToast('Moved to "'+dest+'"');
  closeMoveModal();
}

// ── workflow ─────────────────────────────────────────────────
function openWorkflowModal(){
  var checked=document.querySelectorAll('.row-check:checked');
  var names=Array.from(checked).map(function(cb){
    var id=parseInt(cb.getAttribute('data-id'));
    var d=deliverables.find(function(x){return x.id===id;});
    return d?(d.code?'('+d.code+') '+d.name:d.name):'';
  }).filter(Boolean).join(', ');
  openWfPicker(names);
}
function closeWorkflowModal(){document.getElementById('workflow-modal').style.display='none';}

var selectedWfMethod=null;
var selectedWfType=null;
var wfApprovers=[];

function selectWorkflowStep(el){el.classList.add('wf-selected');}

function selectWfMethod(method){
  selectedWfMethod=method;
  ['approval','review','info','esign'].forEach(function(m){
    var el=document.getElementById('wfm-'+m);
    if(el) el.classList.toggle('wf-sel', m===method);
  });
}

function selectWfType(type){
  selectedWfType=type;
  ['parallel','series','custom'].forEach(function(t){
    var el=document.getElementById('wft-'+t);
    if(el) el.classList.toggle('wf-sel', t===type);
  });
  var descs={
    parallel:'All recipients receive the document simultaneously and act independently.',
    series:'Recipients act one after another in a defined sequence.',
    custom:'Define your own order and conditions for each step.'
  };
  var d=document.getElementById('wft-desc');
  if(d) d.textContent=descs[type]||'';
  var sec=document.getElementById('wf-approvers-section');
  if(sec) sec.style.display='block';
  var badge=document.getElementById('wf-type-badge');
  if(badge){var labels={parallel:'Parallel',series:'Series',custom:'Custom'};badge.textContent=labels[type]||'';}
  renderWfApprovers();
}

function addWfApprover(){
  var input=document.getElementById('wf-email-input');
  var err=document.getElementById('wf-email-err');
  var val=input.value.trim();
  err.style.display='none';
  if(!val){err.textContent='Please enter an email address.';err.style.display='block';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){err.textContent='Please enter a valid email address.';err.style.display='block';return;}
  if(wfApprovers.indexOf(val)!==-1){err.textContent='This email is already added.';err.style.display='block';return;}
  wfApprovers.push(val);
  input.value='';
  renderWfApprovers();
}

function removeWfApprover(idx){
  wfApprovers.splice(idx,1);
  renderWfApprovers();
}

function moveWfApproverUp(i){
  if(i===0)return;
  var tmp=wfApprovers[i]; wfApprovers[i]=wfApprovers[i-1]; wfApprovers[i-1]=tmp;
  renderWfApprovers();
}

function renderWfApprovers(){
  var list=document.getElementById('wf-approver-list');
  if(!list)return;
  if(wfApprovers.length===0){
    list.innerHTML='<div style="text-align:center;padding:14px;color:#b0bec5;font-size:11px;border:1px dashed rgba(34,79,147,0.15);border-radius:7px;">No approvers added yet</div>';
    return;
  }
  list.innerHTML=wfApprovers.map(function(email,i){
    var initials=email.substring(0,2).toUpperCase();
    var orderBadge=selectedWfType==='series'?'<span style="min-width:18px;height:18px;background:#224F93;color:#fff;border-radius:50%;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(i+1)+'</span>':'';
    return '<div style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:#f4f8fd;border:1px solid rgba(34,79,147,0.1);border-radius:7px;margin-bottom:6px;">'
      +(selectedWfType==='series'?orderBadge:'')
      +'<div style="width:28px;height:28px;background:rgba(34,79,147,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:700;color:#224F93;">'+initials+'</div>'
      +'<span style="flex:1;font-size:12px;color:#1a2a3a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+email+'</span>'
      +(selectedWfType==='series'&&i>0?'<button onclick="moveWfApproverUp('+i+')" style="background:none;border:none;cursor:pointer;color:#8099b0;padding:2px 5px;" title="Move up"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>':'')
      +'<button onclick="removeWfApprover('+i+')" style="background:none;border:none;cursor:pointer;color:#c02020;font-size:12px;font-weight:700;padding:2px 6px;border-radius:4px;" title="Remove">✕</button>'
      +'</div>';
  }).join('');
}

function toggleWfAutoRoute(cb){
  var track=document.getElementById('wf-toggle-track');
  var thumb=document.getElementById('wf-toggle-thumb');
  if(cb.checked){track.style.background='#224F93';thumb.style.transform='translateX(18px)';}
  else{track.style.background='#d0d8e4';thumb.style.transform='translateX(0)';}
}

function confirmWorkflow(){
  if(!selectedWfMethod){showToast('Please select a workflow method');return;}
  if(!selectedWfType){showToast('Please select a workflow type');return;}
  if(wfApprovers.length===0){showToast('Please add at least one approver');return;}
  var auto=document.getElementById('wf-auto-route').checked;
  var methodLabels={approval:'For Approval',review:'For Review',info:'For Info',esign:'E-Sign'};
  var typeLabels={parallel:'Parallel',series:'Series',custom:'Custom'};
  var msg=methodLabels[selectedWfMethod]+' · '+typeLabels[selectedWfType]+' · '+wfApprovers.length+' approver'+(wfApprovers.length===1?'':'s')+(auto?' · Auto-route ON':'');
  showToast('Workflow applied: '+msg);
  closeWorkflowModal();
}

var wfMode='standard'; // 'standard' or 'payment'

function setWorkflowMode(mode){
  wfMode=mode;
  var std=document.getElementById('wfm-standard');
  var pay=document.getElementById('wfm-payment');
  if(std) std.style.display=mode==='payment'?'none':'flex';
  if(pay) pay.style.display=mode==='payment'?'flex':'none';
  // auto-select E-Sign when in payment mode
  if(mode==='payment') selectWfMethod('esign');
}

function resetWorkflowModal(){
  selectedWfMethod=null; selectedWfType=null; wfApprovers=[];
  ['approval','review','info','esign'].forEach(function(m){var e=document.getElementById('wfm-'+m);if(e)e.classList.remove('wf-sel');});
  ['parallel','series','custom'].forEach(function(t){var e=document.getElementById('wft-'+t);if(e)e.classList.remove('wf-sel');});
  var d=document.getElementById('wft-desc');if(d)d.textContent='';
  var sec=document.getElementById('wf-approvers-section');if(sec)sec.style.display='none';
  var inp=document.getElementById('wf-email-input');if(inp)inp.value='';
  var err=document.getElementById('wf-email-err');if(err)err.style.display='none';
  var cb=document.getElementById('wf-auto-route');
  if(cb){cb.checked=false;toggleWfAutoRoute(cb);}
  renderWfApprovers();
}

// ── toast ────────────────────────────────────────────────────
function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.style.opacity='1';t.style.transform='translateY(0)';
  setTimeout(function(){t.style.opacity='0';t.style.transform='translateY(10px)';},2200);
}

// ── GED Storage helpers ───────────────────────────────────────
var GED_BUCKET='ged-documents';
var _downloadFileRefs=[];

// ── Visa / Intervenant constants ──────────────────────────────
var GED_INTERVENANTS=[
  {key:'bet-facade',  short:'BET Fac.'},
  {key:'bct-facade',  short:'BCT Fac.'},
  {key:'architecte',  short:'Archi.'},
  {key:'bet-ssi',     short:'SSI'},
  {key:'bet-acous',   short:'Acous.'},
  {key:'amo-hqe',     short:'HQE'},
  {key:'amo',         short:'AMO'},
  {key:'mo',          short:'MO'},
];
var GED_IV_COMPANY_MAP={
  'Ferres':'bet-facade',
  'Save Controls':'bct-facade',
  'OZA':'architecte','KREA':'architecte','OZA / KREA':'architecte',
  'Sepsi':'bet-ssi',
  'Accoustichok':'bet-acous',
  'EESM':'amo-hqe',
  'AMODEV':'amo',
  'Maydane':'mo',
};
var WF_TO_VISA={approved:'VSO',noted:'VAO',rejected:'REJ'};
var FOLDER_GRID='36px minmax(180px,1fr) 90px 100px 62px 62px 62px 62px 62px 62px 62px 62px 44px';
var _visaStatuses={};
var _visaAutoStatuses={};
var _visaCellTarget=null;

function gedFmtSize(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB';}

async function gedLoadFiles(folderId,folderType){
  var {data,error}=await sb.from('ged_files').select('*').eq('project','batidoc').eq('folder_id',String(folderId)).eq('folder_type',folderType).order('created_at');
  if(error||!data)return [];
  return data.map(function(r){var d=new Date(r.created_at);var ds=('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();return {id:r.id,name:r.name,size:r.size_label||'—',date:ds,storage_path:r.storage_path,created_at:r.created_at};});
}

async function gedUploadFile(file,folderId,folderType){
  var fileId=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'_'+Math.random().toString(36).slice(2));
  var path='batidoc/'+folderType+'/'+String(folderId)+'/'+fileId+'/'+file.name;
  var {error:upErr}=await sb.storage.from(GED_BUCKET).upload(path,file,{upsert:false});
  if(upErr){showToast('Upload failed: '+file.name);return null;}
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  var {data:row,error:dbErr}=await sb.from('ged_files').insert({project:'batidoc',folder_id:String(folderId),folder_type:folderType,name:file.name,storage_path:path,size_bytes:file.size,size_label:gedFmtSize(file.size),mime_type:file.type||'',uploaded_by:(sbProfile&&(sbProfile.username||sbProfile.full_name))||''}).select().single();
  if(dbErr){showToast('Save error: '+file.name);return null;}
  return {id:row.id,name:row.name,size:row.size_label,date:ds,storage_path:row.storage_path,created_at:row.created_at};
}

async function gedDeleteFiles(files){
  var paths=files.filter(function(f){return f.storage_path;}).map(function(f){return f.storage_path;});
  var ids=files.filter(function(f){return f.id;}).map(function(f){return f.id;});
  if(paths.length)await sb.storage.from(GED_BUCKET).remove(paths);
  if(ids.length)await sb.from('ged_files').delete().in('id',ids);
}

async function gedDownloadFiles(files){
  for(var i=0;i<files.length;i++){
    var f=files[i];if(!f.storage_path)continue;
    var {data,error}=await sb.storage.from(GED_BUCKET).createSignedUrl(f.storage_path,300);
    if(data&&data.signedUrl){var a=document.createElement('a');a.href=data.signedUrl;a.download=f.name;document.body.appendChild(a);a.click();document.body.removeChild(a);}
  }
}

async function gedDuplicateFile(origFile,folderId,folderType){
  var {data,error}=await sb.storage.from(GED_BUCKET).createSignedUrl(origFile.storage_path,120);
  if(!data||!data.signedUrl)return null;
  var resp=await fetch(data.signedUrl);var blob=await resp.blob();
  var dot=origFile.name.lastIndexOf('.');
  var base=dot!==-1?origFile.name.slice(0,dot):origFile.name;
  var ext=dot!==-1?origFile.name.slice(dot):'';
  return await gedUploadFile(new File([blob],base+' (copy)'+ext,{type:blob.type}),folderId,folderType);
}

// ── folder open & upload ─────────────────────────────────────
var folderFiles={};     // keyed by folderId: array of {id,name,size,date,storage_path}
var folderSubs={};      // keyed by folderId: array of {id,name,date}
var currentFolderId=null;
var folderStack=[];     // navigation stack [{id, label}]

async function openFolder(id){
  var d=deliverables.find(function(x){return x.id===id;});
  if(!d)return;
  var dn=d.num||d.id;
  var label=d.code?dn+'. ('+d.code+') '+d.name:dn+'. '+d.name;
  folderStack=[{id:id,label:label}];
  currentFolderId=id;
  renderBreadcrumb();
  document.getElementById('view-list').style.display='none';
  document.getElementById('view-folder').style.display='block';
  folderFiles[id]=await gedLoadFiles(id,'deliverable');
  renderFolderFiles();
  loadFolderVisaFromWorkflow(folderFiles[id]);
}

async function openSubFolder(parentId, subId){
  var subs=folderSubs[parentId]||[];
  var sub=subs.find(function(s){return s.id===subId;});
  if(!sub)return;
  var key='sub:'+parentId+':'+subId;
  folderStack.push({id:key, label:sub.name});
  currentFolderId=key;
  renderBreadcrumb();
  folderFiles[key]=await gedLoadFiles(key,'deliverable');
  renderFolderFiles();
  loadFolderVisaFromWorkflow(folderFiles[key]);
}

function navigateTo(stackIdx){
  folderStack=folderStack.slice(0,stackIdx+1);
  currentFolderId=folderStack[folderStack.length-1].id;
  renderBreadcrumb();
  renderFolderFiles();
}

function closeFolder(){
  document.getElementById('view-folder').style.display='none';
  document.getElementById('view-list').style.display='block';
  currentFolderId=null;
  folderStack=[];
}

function renderBreadcrumb(){
  var bc=document.getElementById('folder-breadcrumb-name');
  // build breadcrumb: "← List of Deliverables  > level1  > level2 ..."
  var html='';
  folderStack.forEach(function(item,i){
    if(i<folderStack.length-1){
      html+='<span onclick="navigateTo('+i+')" style="cursor:pointer;color:#224F93;font-weight:600;">'+item.label+'</span>';
      html+='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b0bec5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>';
    } else {
      html+='<span style="color:#1a2a3a;font-weight:700;">'+item.label+'</span>';
    }
  });
  bc.innerHTML=html;
  // update folder title
  var last=folderStack[folderStack.length-1];
  document.getElementById('folder-view-title').textContent=last.label;
}

function renderFolderFiles(){
  var files=folderFiles[currentFolderId]||[];
  var subs=folderSubs[currentFolderId]||[];
  var container=document.getElementById('folder-file-list');
  if(!container)return;
  var total=subs.length+files.length;
  var countEl=document.getElementById('folder-view-count');
  if(countEl){
    var parts=[];
    if(subs.length) parts.push(subs.length+' folder'+(subs.length===1?'':'s'));
    if(files.length) parts.push(files.length+' file'+(files.length===1?'':'s'));
    countEl.textContent=total===0?'Empty folder':parts.join(', ');
  }
  var fall=document.getElementById('fcheck-all');
  if(fall) fall.checked=false;
  if(total===0){
    container.innerHTML='<div style="padding:36px;text-align:center;color:#8099b0;font-size:12px;">Empty folder. Create a subfolder or upload files.</div>';
    updateFileToolbar();
    return;
  }

  var html='';

  // ── subfolders ──
  subs.forEach(function(sub,si){
    var bg=si%2===0?'#fff':'#fafcff';
    html+='<div style="display:grid;grid-template-columns:'+FOLDER_GRID+';align-items:center;padding:0 14px;height:46px;background:'+bg+';border-bottom:1px solid rgba(34,79,147,0.05);transition:background 0.1s;" onmouseover="this.style.background=\'#eef4ff\'" onmouseout="this.style.background=\''+bg+'\'">'
      +'<div style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" class="frow-check" data-idx="sub:'+si+'" onchange="updateFileToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;"></div>'
      +'<div style="display:flex;align-items:center;gap:8px;overflow:hidden;cursor:pointer;" onclick="openSubFolder(\''+currentFolderId+'\','+sub.id+')">'
      +'<svg width="18" height="15" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><path fill="#90a4ae" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(sub.num||sub.id)+'. '+sub.name+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#b0bec5;text-align:center;">—</div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;text-align:center;">'+sub.date+'</div>'
      +GED_INTERVENANTS.map(function(){return '<div></div>';}).join('')
      +'<div style="display:flex;justify-content:center;">'
      +'<button onclick="removeSubFolder(\''+currentFolderId+'\','+sub.id+')" style="background:none;border:none;cursor:pointer;color:#c02020;font-size:12px;font-weight:700;padding:4px 8px;border-radius:4px;" title="Remove">✕</button>'
      +'</div>'
      +'</div>';
  });

  // ── files ──
  files.forEach(function(f,fi){
    var rowIdx=subs.length+fi;
    var ext=f.name.split('.').pop().toLowerCase();
    var ic=ext==='pdf'?'#e05555':ext==='docx'||ext==='doc'?'#2d65bd':ext==='xlsx'||ext==='xls'?'#1a9458':'#8099b0';
    var bg=rowIdx%2===0?'#fff':'#fafcff';
    var visaCells=GED_INTERVENANTS.map(function(iv){
      var vs=getVisaStatus(f.id,iv.key);
      var badge=vs.status?visaBadge(vs.status):'<span style="color:#d0dae6;font-size:12px;">—</span>';
      var autoMark=vs.source==='auto'?'<span style="font-size:8px;color:#b0bec5;vertical-align:super;" title="Auto from workflow">⚡</span>':'';
      var hasReply=vs.replyName?'<span style="display:block;width:5px;height:5px;border-radius:50%;background:#1a9458;position:absolute;top:6px;right:6px;" title="Reply attached"></span>':'';
      return '<div style="display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;padding:0 2px;transition:background 0.1s;border-left:1px solid rgba(34,79,147,0.05);" onclick="openVisaCell(\''+f.id+'\',\''+iv.key+'\',this)" onmouseover="this.style.background=\'rgba(34,79,147,0.04)\'" onmouseout="this.style.background=\'\'">'+badge+autoMark+hasReply+'</div>';
    }).join('');
    html+='<div style="display:grid;grid-template-columns:'+FOLDER_GRID+';align-items:center;padding:0 14px;height:44px;background:'+bg+';border-bottom:1px solid rgba(34,79,147,0.05);">'
      +'<div style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" class="frow-check" data-idx="'+fi+'" onchange="updateFileToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;"></div>'
      +'<div style="display:flex;align-items:center;gap:9px;overflow:hidden;">'
      +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="'+ic+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+f.name+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#8099b0;text-align:center;">'+f.size+'</div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;text-align:center;">'+f.date+'</div>'
      +visaCells
      +'<div style="display:flex;justify-content:center;">'
      +'<button onclick="removeFile('+fi+')" style="background:none;border:none;cursor:pointer;color:#c02020;font-size:12px;font-weight:700;padding:4px 8px;border-radius:4px;" title="Remove">✕</button>'
      +'</div>'
      +'</div>';
  });

  container.innerHTML=html;
  updateFileToolbar();
}

async function removeFile(i){
  if(!folderFiles[currentFolderId])return;
  var f=folderFiles[currentFolderId][i];
  if(f)await gedDeleteFiles([f]);
  folderFiles[currentFolderId].splice(i,1);
  renderFolderFiles();
}

function removeSubFolder(parentId, subId){
  if(!folderSubs[parentId])return;
  folderSubs[parentId]=folderSubs[parentId].filter(function(s){return s.id!==subId;});
  delete folderFiles['sub:'+parentId+':'+subId];
  delete folderSubs['sub:'+parentId+':'+subId];
  renderFolderFiles();
}

// ── Visa status helpers ───────────────────────────────────────
function visaBadge(status){
  if(!status) return '<span style="color:#d0dae6;font-size:12px;">—</span>';
  var c={PR:'#0891b2',PI:'#0891b2',VSO:'#14532d',VAO:'#16a34a',VAOB:'#dc2626',REJ:'#991b1b',NS:'#6b7280',NC:'#14532d',EA:'#ca8a04'}[status]||'#8099b0';
  var b={PR:'#ecfeff',PI:'#ecfeff',VSO:'#dcfce7',VAO:'#f0fdf4',VAOB:'#fee2e2',REJ:'#fecaca',NS:'#f3f4f6',NC:'#dcfce7',EA:'#fef9c3'}[status]||'#f0f4f9';
  return '<span style="display:inline-block;padding:2px 5px;border-radius:4px;background:'+b+';color:'+c+';font-size:10px;font-weight:700;border:1px solid '+c+'40;white-space:nowrap;line-height:1.5;">'+status+'</span>';
}

function getVisaStatus(fileId, ivKey){
  var m=(_visaStatuses[fileId]||{})[ivKey];
  if(m) return {status:m.status,source:'manual',replyName:m.replyName||''};
  var a=(_visaAutoStatuses[fileId]||{})[ivKey];
  if(a) return {status:a,source:'auto'};
  return {};
}

function openVisaCell(fileId, ivKey, el){
  _visaCellTarget={fileId:fileId,ivKey:ivKey};
  var popup=document.getElementById('visa-popup');
  if(!popup) return;
  var vs=(_visaStatuses[fileId]||{})[ivKey]||{};
  var ri=document.getElementById('visa-reply-info');
  if(vs.replyName){ri.style.display='block';ri.textContent='📎 '+vs.replyName;}
  else{ri.style.display='none';ri.textContent='';}
  var rect=el.getBoundingClientRect();
  var pw=220;
  var left=Math.min(rect.left,window.innerWidth-pw-8);
  var top=rect.bottom+4;
  if(top+200>window.innerHeight) top=rect.top-220;
  popup.style.top=Math.max(8,top)+'px';
  popup.style.left=Math.max(8,left)+'px';
  popup.style.display='flex';
  setTimeout(function(){document.addEventListener('click',_visaOutside,{once:true});},0);
}

function _visaOutside(e){
  var p=document.getElementById('visa-popup');
  if(p&&!p.contains(e.target)) closeVisaPopup();
}

function closeVisaPopup(){
  var p=document.getElementById('visa-popup');
  if(p) p.style.display='none';
  _visaCellTarget=null;
}

async function setVisaStatus(status){
  if(!_visaCellTarget) return;
  var fid=_visaCellTarget.fileId, ik=_visaCellTarget.ivKey;
  if(!_visaStatuses[fid]) _visaStatuses[fid]={};
  if(status){
    _visaStatuses[fid][ik]=Object.assign(_visaStatuses[fid][ik]||{},{status:status});
  } else {
    delete _visaStatuses[fid][ik];
    if(!Object.keys(_visaStatuses[fid]).length) delete _visaStatuses[fid];
  }
  closeVisaPopup();
  renderFolderFiles();
  await saveVisaStatuses();
}

function triggerVisaUpload(){
  document.getElementById('visa-file-input').click();
}

async function handleVisaUpload(input){
  if(!_visaCellTarget||!input.files||!input.files[0]) return;
  var fid=_visaCellTarget.fileId, ik=_visaCellTarget.ivKey;
  var file=input.files[0];
  var safeName=file.name.replace(/[^a-zA-Z0-9._\-]/g,'_');
  var path='visa-replies/'+Date.now()+'_'+safeName;
  showToast('Uploading reply…');
  var {error}=await sb.storage.from(GED_BUCKET).upload(path,file,{cacheControl:'3600',upsert:true});
  if(error){showToast('Upload failed');input.value='';return;}
  if(!_visaStatuses[fid]) _visaStatuses[fid]={};
  _visaStatuses[fid][ik]=Object.assign(_visaStatuses[fid][ik]||{},{replyName:file.name,replyPath:path});
  closeVisaPopup();
  renderFolderFiles();
  await saveVisaStatuses();
  input.value='';
  showToast('Reply uploaded');
}

async function loadFolderVisaFromWorkflow(files){
  _visaAutoStatuses={};
  if(!files||!files.length) return;
  try{
    var {data:instances}=await sb.from('ged_workflow_instances').select('id,document_names').order('applied_at',{ascending:false});
    if(!instances||!instances.length) return;
    var names=files.map(function(f){return f.name.toLowerCase();});
    var relevant=instances.filter(function(inst){
      return inst.document_names&&names.some(function(n){return inst.document_names.toLowerCase().indexOf(n)!==-1;});
    });
    if(!relevant.length) return;
    var ids=relevant.map(function(i){return i.id;});
    var {data:recips}=await sb.from('ged_workflow_recipients').select('instance_id,company,status').in('instance_id',ids).neq('status','pending');
    if(!recips||!recips.length) return;
    files.forEach(function(f){
      var fname=f.name.toLowerCase();
      relevant.forEach(function(inst){
        if(!inst.document_names||inst.document_names.toLowerCase().indexOf(fname)===-1) return;
        recips.filter(function(r){return r.instance_id===inst.id;}).forEach(function(r){
          var ivKey=GED_IV_COMPANY_MAP[r.company||''];
          var visa=WF_TO_VISA[r.status];
          if(ivKey&&visa){
            if(!_visaAutoStatuses[f.id]) _visaAutoStatuses[f.id]={};
            if(!_visaAutoStatuses[f.id][ivKey]) _visaAutoStatuses[f.id][ivKey]=visa;
          }
        });
      });
    });
    renderFolderFiles();
  }catch(e){console.error('loadFolderVisaFromWorkflow',e);}
}

// ── subfolder modal ──────────────────────────────────────────
function openSubfolderModal(){
  document.getElementById('subfolder-input').value='';
  document.getElementById('subfolder-err').style.display='none';
  document.getElementById('subfolder-modal').style.display='flex';
  setTimeout(function(){document.getElementById('subfolder-input').focus();},80);
}
function closeSubfolderModal(){
  document.getElementById('subfolder-modal').style.display='none';
}
function confirmSubfolder(){
  var val=document.getElementById('subfolder-input').value.trim();
  if(!val){document.getElementById('subfolder-err').textContent='Please enter a folder name.';document.getElementById('subfolder-err').style.display='block';return;}
  if(!folderSubs[currentFolderId]) folderSubs[currentFolderId]=[];
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  var existing=folderSubs[currentFolderId];
  var newId=Date.now();
  var newNum=existing.length?Math.max.apply(null,existing.map(function(s){return s.num||0;}))+1:1;
  existing.push({id:newId,num:newNum,name:val,date:ds});
  closeSubfolderModal();
  renderFolderFiles();
  showToast('Folder "'+val+'" created');
}

// ── file toolbar ─────────────────────────────────────────────
function toggleAllFiles(cb){
  document.querySelectorAll('.frow-check').forEach(function(c){c.checked=cb.checked;});
  updateFileToolbar();
}

function updateFileToolbar(){
  var checked=document.querySelectorAll('.frow-check:checked');
  var one=checked.length===1, any=checked.length>0;
  function setFBtn(id,enabled){
    var b=document.getElementById(id);
    if(!b)return;
    b.style.opacity=enabled?'1':'0.45';
    b.style.pointerEvents=enabled?'auto':'none';
  }
  setFBtn('fbtn-rename',   one);
  setFBtn('fbtn-duplicate',any);
  setFBtn('fbtn-move',     any);
  setFBtn('fbtn-workflow', any);
  setFBtn('fbtn-status',   one);
  setFBtn('fbtn-download', any);
  setFBtn('fbtn-delete',   any);
}

function getCheckedFileIdxs(){
  return Array.from(document.querySelectorAll('.frow-check:checked'))
    .map(function(c){return c.getAttribute('data-idx');})
    .filter(function(v){return v.indexOf('sub:')===-1;})
    .map(function(v){return parseInt(v);});
}

function openFileRenameModal(){
  var idxs=getCheckedFileIdxs();
  if(idxs.length!==1)return;
  var f=(folderFiles[currentFolderId]||[])[idxs[0]];
  if(!f)return;
  document.getElementById('rename-input').value=f.name;
  document.getElementById('rename-err').style.display='none';
  document.getElementById('rename-modal').setAttribute('data-id','file:'+idxs[0]);
  document.getElementById('rename-modal').style.display='flex';
  setTimeout(function(){document.getElementById('rename-input').focus();},80);
}

async function duplicateFile(){
  var files=folderFiles[currentFolderId]||[];
  var idxs=getCheckedFileIdxs().sort(function(a,b){return b-a;});
  showToast('Duplicating…');
  for(var ii=0;ii<idxs.length;ii++){
    var i=idxs[ii];var f=files[i];if(!f)continue;
    var rec=await gedDuplicateFile(f,currentFolderId,'deliverable');
    if(rec)files.splice(i+1,0,rec);
  }
  document.getElementById('fcheck-all').checked=false;
  renderFolderFiles();
  showToast(idxs.length+' file'+(idxs.length===1?' duplicated':'s duplicated'));
}
function _duplicateFile_OLD(){
  var files=folderFiles[currentFolderId]||[];
  var idxs=getCheckedFileIdxs().sort(function(a,b){return b-a;});
  idxs.forEach(function(i){
    var f=files[i];
    if(!f)return;
    var ext=f.name.lastIndexOf('.')!==-1?f.name.slice(f.name.lastIndexOf('.')):'';
    var base=f.name.lastIndexOf('.')!==-1?f.name.slice(0,f.name.lastIndexOf('.')):f.name;
    files.splice(i+1,0,{name:base+' (copy)'+ext,size:f.size,date:f.date});
  });
  document.getElementById('fcheck-all').checked=false;
  renderFolderFiles();
}

function openFileMoveModal(){
  document.getElementById('move-dest').value='';
  var idxs=getCheckedFileIdxs();
  var files=folderFiles[currentFolderId]||[];
  var names=idxs.map(function(i){return files[i]?files[i].name:'';}).filter(Boolean).join(', ');
  document.getElementById('move-item-names').textContent=names;
  document.getElementById('move-modal').setAttribute('data-ctx','file');
  document.getElementById('move-modal').style.display='flex';
}

function openFileWorkflowModal(){
  var idxs=getCheckedFileIdxs();
  var files=folderFiles[currentFolderId]||[];
  var names=idxs.map(function(i){return files[i]?files[i].name:'';}).filter(Boolean).join(', ');
  openWfPicker(names);
}

async function openFileStatusModal(){
  var idxs=getCheckedFileIdxs();
  var files=folderFiles[currentFolderId]||[];
  if(idxs.length!==1)return;
  var file=files[idxs[0]];
  var fileName=file?file.name:'';
  document.getElementById('status-modal-subtitle').textContent=fileName;
  document.getElementById('status-modal-body').innerHTML='<p style="font-size:12px;color:#8099b0;">Loading…</p>';
  document.getElementById('status-modal').style.display='flex';

  var q=sb.from('ged_workflow_instances').select('*').ilike('document_names','%'+fileName+'%');
  if(file&&file.created_at) q=q.gte('applied_at',file.created_at);
  var {data:instances}=await q.order('applied_at',{ascending:false});
  if(!instances||instances.length===0){
    document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">No workflow has been applied to this file yet.</p>';
    return;
  }
  var ids=instances.map(function(i){return i.id;});
  var {data:allRecips}=await sb.from('ged_workflow_recipients').select('*').in('instance_id',ids);
  document.getElementById('status-modal-body').innerHTML=renderStatusInstances(instances,allRecips);
}

function downloadFile(){
  var idxs=getCheckedFileIdxs();
  var files=folderFiles[currentFolderId]||[];
  _downloadFileRefs=idxs.map(function(i){return files[i];}).filter(Boolean);
  var names=_downloadFileRefs.map(function(f){return f.name;});
  document.getElementById('download-names').innerHTML=names.map(function(n){
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(34,79,147,0.06);">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a90d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;">'+n+'</span></div>';
  }).join('');
  document.getElementById('download-modal').style.display='flex';
}

async function deleteFile(){
  var idxs=getCheckedFileIdxs().sort(function(a,b){return b-a;});
  var files=folderFiles[currentFolderId]||[];
  var toDelete=idxs.map(function(i){return files[i];}).filter(Boolean);
  await gedDeleteFiles(toDelete);
  idxs.forEach(function(i){files.splice(i,1);});
  document.getElementById('fcheck-all').checked=false;
  renderFolderFiles();
  showToast(idxs.length+' file'+(idxs.length===1?' deleted':'s deleted'));
}

function handleDropZoneClick(){document.getElementById('file-input').click();}
function handleFileInput(input){handleFiles(input.files);input.value='';}

function handleDrop(e){
  e.preventDefault();
  e.currentTarget.style.borderColor='rgba(34,79,147,0.25)';
  e.currentTarget.style.background='rgba(34,79,147,0.02)';
  handleFiles(e.dataTransfer.files);
}
function handleDragOver(e){
  e.preventDefault();
  e.currentTarget.style.borderColor='#224F93';
  e.currentTarget.style.background='rgba(34,79,147,0.05)';
}
function handleDragLeave(e){
  e.currentTarget.style.borderColor='rgba(34,79,147,0.25)';
  e.currentTarget.style.background='rgba(34,79,147,0.02)';
}

async function handleFiles(fileList){
  if(!folderFiles[currentFolderId])folderFiles[currentFolderId]=[];
  var arr=Array.from(fileList);
  showToast('Uploading '+arr.length+' file'+(arr.length===1?'':'s')+'…');
  for(var i=0;i<arr.length;i++){
    var rec=await gedUploadFile(arr[i],currentFolderId,'deliverable');
    if(rec)folderFiles[currentFolderId].push(rec);
  }
  renderFolderFiles();
  showToast(arr.length+' file'+(arr.length===1?' uploaded':'s uploaded'));
}

// ── payments folders ──────────────────────────────────────────
var payFolders=[
  {id:1, num:1, name:'Decompte 001', date:'22/03/2026'}
];
var payFolderFiles={};   // keyed by folder id
var currentPayFolderId=null;

function renderPayFolders(){
  var list=document.getElementById('pay-folder-list');
  if(!list)return;
  if(payFolders.length===0){
    list.innerHTML='<div style="padding:36px;text-align:center;color:#8099b0;font-size:12px;">No folders yet. Click New Folder to create one.</div>';
    updatePayToolbar();
    return;
  }
  list.innerHTML=payFolders.map(function(f,i){
    var bg=i%2===0?'#fff':'#fafcff';
    return '<div class="del-row" style="background:'+bg+';" onmouseover="this.style.background=\'#eef4ff\'" onmouseout="this.style.background=\''+bg+'\'">'
      +'<div style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" class="pay-row-check" data-id="'+f.id+'" onchange="updatePayToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;"></div>'
      +'<div style="display:flex;align-items:center;gap:8px;overflow:hidden;cursor:pointer;" onclick="openPayFolder('+f.id+')">'
      +'<svg width="18" height="15" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><path fill="#90a4ae" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(f.num||f.id)+'. '+f.name+'</span>'
      +'<span id="pay-badge-'+f.id+'" style="flex-shrink:0;margin-left:4px;"></span>'
      +'</div>'
      +'<div></div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;text-align:right;padding-right:4px;">'+f.date+'</div>'
      +'<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">'+payActionsSVG()+'</div>'
      +'</div>';
  }).join('');
  updatePayToolbar();
  loadPayFolderBadges();
}

function payActionsSVG(){
  var c='#c0ccd8';
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
}

async function loadPayFolderBadges(){
  var {data:instances}=await sb.from('ged_workflow_instances').select('*').order('applied_at',{ascending:false});
  if(!instances)instances=[];
  var recips=[];
  if(instances.length){
    var ids=instances.map(function(i){return i.id;});
    var {data:r}=await sb.from('ged_workflow_recipients').select('instance_id,status,action').in('instance_id',ids);
    if(r)recips=r;
  }
  payFolders.forEach(function(f){
    var el=document.getElementById('pay-badge-'+f.id);
    if(!el)return;
    var name=f.name.toLowerCase();
    var matching=instances.filter(function(inst){return inst.document_names&&inst.document_names.toLowerCase().indexOf(name)!==-1;});
    if(matching.length===0){el.innerHTML=wfBadgePill('Not Submitted','#8099b0','#f0f4f9');return;}
    var inst=matching[0];
    var ir=recips.filter(function(r){return r.instance_id===inst.id;});
    var total=ir.length;
    if(inst.status==='pending'){el.innerHTML=wfBadgePill('In Progress','#d97706','#fffbeb');return;}
    var approvedCnt=ir.filter(function(r){return r.status==='approved'||r.status==='noted';}).length;
    var rejectedCnt=ir.filter(function(r){return r.status==='rejected';}).length;
    if(rejectedCnt>0){
      var parts=[];
      if(approvedCnt>0)parts.push(approvedCnt+'/'+total+' Approved');
      parts.push(rejectedCnt+'/'+total+' Rejected');
      el.innerHTML=wfBadgePill(parts.join(' · '),'#e53e3e','#fff5f5');
      return;
    }
    var lbl={approved:'Approved',signed:'Signed',noted:'Acknowledged',completed:'Approved'}[inst.status]||'Approved';
    var col={approved:'#1a9458',signed:'#7c3aed',noted:'#224F93',completed:'#1a9458'}[inst.status]||'#1a9458';
    var bg={approved:'#f0fdf4',signed:'#faf5ff',noted:'#eff6ff',completed:'#f0fdf4'}[inst.status]||'#f0fdf4';
    var txt=total>1?approvedCnt+'/'+total+' '+lbl:lbl;
    el.innerHTML=wfBadgePill(txt,col,bg);
  });
}

function updatePayToolbar(){
  var checked=document.querySelectorAll('.pay-row-check:checked');
  var one=checked.length===1, any=checked.length>0;
  function s(id,en){var b=document.getElementById(id);if(b){b.style.opacity=en?'1':'0.45';b.style.pointerEvents=en?'auto':'none';}}
  s('paybtn-rename',    one);
  s('paybtn-duplicate', any);
  s('paybtn-move',      any);
  s('paybtn-workflow',  any);
  s('paybtn-status',    one);
  s('paybtn-download',  any);
  s('paybtn-delete',    any);
}

function getCheckedPayFolderIds(){
  return Array.from(document.querySelectorAll('.pay-row-check:checked')).map(function(c){return parseInt(c.getAttribute('data-id'));});
}

function duplicatePayFolder(){
  var ids=getCheckedPayFolderIds();
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  ids.forEach(function(id){
    var f=payFolders.find(function(x){return x.id===id;});
    if(!f)return;
    var newId=Date.now();
    var newNum=Math.max.apply(null,payFolders.map(function(x){return x.num||0;}))+1;
    var idx=payFolders.indexOf(f);
    payFolders.splice(idx+1,0,{id:newId,num:newNum,name:f.name+' (copy)',date:ds});
    if(payFolderFiles[id]) payFolderFiles[newId]=payFolderFiles[id].slice();
  });
  document.getElementById('pay-check-all').checked=false;
  renderPayFolders();
  showToast(ids.length+' folder'+(ids.length===1?' duplicated':'s duplicated'));
}

function openPayFolderMoveModal(){
  var ids=getCheckedPayFolderIds();
  var names=ids.map(function(id){var f=payFolders.find(function(x){return x.id===id;});return f?f.name:'';}).filter(Boolean).join(', ');
  document.getElementById('move-dest').value='';
  document.getElementById('move-item-names').textContent=names;
  document.getElementById('move-modal').setAttribute('data-ctx','payfolder');
  document.getElementById('move-modal').style.display='flex';
}

function openPayFolderWorkflowModal(){
  var ids=getCheckedPayFolderIds();
  var names=ids.map(function(id){var f=payFolders.find(function(x){return x.id===id;});return f?f.name:'';}).filter(Boolean).join(', ');
  openWfPicker(names);
}

async function openPayFolderStatusModal(){
  var ids=getCheckedPayFolderIds();
  if(ids.length!==1)return;
  var f=payFolders.find(function(x){return x.id===ids[0];});
  var folderName=f?f.name:'';
  document.getElementById('status-modal-subtitle').textContent=folderName;
  document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">Loading…</p>';
  document.getElementById('status-modal').style.display='flex';
  var {data:instances}=await sb.from('ged_workflow_instances').select('*').ilike('document_names','%'+folderName+'%').order('applied_at',{ascending:false});
  if(!instances||instances.length===0){
    document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">No workflow has been applied to this folder yet.</p>';
    return;
  }
  var ids2=instances.map(function(i){return i.id;});
  var {data:allRecips}=await sb.from('ged_workflow_recipients').select('*').in('instance_id',ids2);
  document.getElementById('status-modal-body').innerHTML=renderStatusInstances(instances,allRecips);
}

function downloadPayFolder(){
  var ids=getCheckedPayFolderIds();
  var names=ids.map(function(id){var f=payFolders.find(function(x){return x.id===id;});return f?f.name:'';}).filter(Boolean);
  document.getElementById('download-names').innerHTML=names.map(function(n){
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(34,79,147,0.06);">'
      +'<svg width="13" height="13" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#90a4ae" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;">'+n+'</span></div>';
  }).join('');
  document.getElementById('download-modal').style.display='flex';
}

function toggleAllPay(cb){
  document.querySelectorAll('.pay-row-check').forEach(function(c){c.checked=cb.checked;});
  updatePayToolbar();
}

// ── new pay folder ────────────────────────────────────────────
function openNewPayFolderModal(){
  document.getElementById('new-pay-folder-input').value='';
  document.getElementById('new-pay-folder-err').style.display='none';
  document.getElementById('new-pay-folder-modal').style.display='flex';
  setTimeout(function(){document.getElementById('new-pay-folder-input').focus();},80);
}
function closeNewPayFolderModal(){document.getElementById('new-pay-folder-modal').style.display='none';}
function confirmNewPayFolder(){
  var val=document.getElementById('new-pay-folder-input').value.trim();
  if(!val){document.getElementById('new-pay-folder-err').textContent='Please enter a folder name.';document.getElementById('new-pay-folder-err').style.display='block';return;}
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  var newId=Date.now();
  var newNum=payFolders.length?Math.max.apply(null,payFolders.map(function(f){return f.num||0;}))+1:1;
  payFolders.push({id:newId,num:newNum,name:val,date:ds});
  closeNewPayFolderModal();
  renderPayFolders();
  showToast('Folder "'+val+'" created');
}

// ── rename pay folder ─────────────────────────────────────────
function openPayRenameModal(){
  var checked=document.querySelectorAll('.pay-row-check:checked');
  if(checked.length!==1)return;
  var id=parseInt(checked[0].getAttribute('data-id'));
  var f=payFolders.find(function(x){return x.id===id;});
  if(!f)return;
  document.getElementById('rename-input').value=f.name;
  document.getElementById('rename-err').style.display='none';
  document.getElementById('rename-modal').setAttribute('data-id','pay:'+id);
  document.getElementById('rename-modal').style.display='flex';
  setTimeout(function(){document.getElementById('rename-input').focus();},80);
}

// ── delete pay folder ─────────────────────────────────────────
function deletePayFolder(){
  var checked=document.querySelectorAll('.pay-row-check:checked');
  if(!checked.length)return;
  var ids=Array.from(checked).map(function(c){return parseInt(c.getAttribute('data-id'));});
  payFolders=payFolders.filter(function(f){return ids.indexOf(f.id)===-1;});
  ids.forEach(function(id){delete payFolderFiles[id];});
  document.getElementById('pay-check-all').checked=false;
  renderPayFolders();
  showToast(ids.length+' folder'+(ids.length===1?' deleted':'s deleted'));
}

// ── open / close pay folder view ─────────────────────────────
async function openPayFolder(id){
  currentPayFolderId=id;
  var f=payFolders.find(function(x){return x.id===id;});
  if(!f)return;
  document.getElementById('pay-folder-breadcrumb').textContent=f.name;
  document.getElementById('pay-folder-title').textContent=f.name;
  document.getElementById('pay-view-list').style.display='none';
  document.getElementById('pay-view-folder').style.display='block';
  payFolderFiles[id]=await gedLoadFiles(id,'payment');
  renderPayFileList();
}
function closePayFolder(){
  document.getElementById('pay-view-folder').style.display='none';
  document.getElementById('pay-view-list').style.display='block';
  currentPayFolderId=null;
}

// ── pay file list ─────────────────────────────────────────────
function renderPayFileList(){
  var files=payFolderFiles[currentPayFolderId]||[];
  var subs=payFolderSubs[currentPayFolderId]||[];
  var container=document.getElementById('pay-file-list');
  if(!container)return;
  var total=subs.length+files.length;
  var countEl=document.getElementById('pay-folder-count');
  if(countEl){
    var parts=[];
    if(subs.length) parts.push(subs.length+' folder'+(subs.length===1?'':'s'));
    if(files.length) parts.push(files.length+' file'+(files.length===1?'':'s'));
    countEl.textContent=total===0?'Empty folder':parts.join(', ');
  }
  var fall=document.getElementById('payf-check-all');
  if(fall) fall.checked=false;
  updatePayFileToolbar();
  if(total===0){
    container.innerHTML='<div style="padding:36px;text-align:center;color:#8099b0;font-size:12px;">Empty folder. Create a subfolder or upload files.</div>';
    return;
  }
  var html='';
  subs.forEach(function(sub,si){
    var bg=si%2===0?'#fff':'#fafcff';
    html+='<div style="display:grid;grid-template-columns:36px 1fr 100px 120px 44px;align-items:center;padding:0 14px;height:46px;background:'+bg+';border-bottom:1px solid rgba(34,79,147,0.05);transition:background 0.1s;" onmouseover="this.style.background=\'#eef4ff\'" onmouseout="this.style.background=\''+bg+'\'">'
      +'<div style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" class="payf-row-check" data-idx="sub:'+si+'" onchange="updatePayFileToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;"></div>'
      +'<div style="display:flex;align-items:center;gap:8px;overflow:hidden;">'
      +'<svg width="18" height="15" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><path fill="#90a4ae" d="M10 2H2C.9 2 0 2.9 0 4v12c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H12L10 2z"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(sub.num||sub.id)+'. '+sub.name+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#b0bec5;">\u2014</div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;">'+sub.date+'</div>'
      +'<div style="display:flex;justify-content:center;"><button onclick="removePaySubFolder('+si+')" style="background:none;border:none;cursor:pointer;color:#c02020;font-size:12px;font-weight:700;padding:4px 8px;border-radius:4px;">\u2715</button></div>'
      +'</div>';
  });
  files.forEach(function(f,fi){
    var rowIdx=subs.length+fi;
    var ext=f.name.split('.').pop().toLowerCase();
    var ic=ext==='pdf'?'#e05555':ext==='docx'||ext==='doc'?'#2d65bd':ext==='xlsx'||ext==='xls'?'#1a9458':'#8099b0';
    var bg=rowIdx%2===0?'#fff':'#fafcff';
    html+='<div style="display:grid;grid-template-columns:36px 1fr 100px 120px 44px;align-items:center;padding:0 14px;height:44px;background:'+bg+';border-bottom:1px solid rgba(34,79,147,0.05);transition:background 0.1s;" onmouseover="this.style.background=\'#eef4ff\'" onmouseout="this.style.background=\''+bg+'\'">'
      +'<div style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" class="payf-row-check" data-idx="'+fi+'" onchange="updatePayFileToolbar()" style="width:15px;height:15px;accent-color:#224F93;cursor:pointer;"></div>'
      +'<div style="display:flex;align-items:center;gap:9px;overflow:hidden;">'
      +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="'+ic+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+f.name+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#8099b0;">'+f.size+'</div>'
      +'<div style="font-size:11px;color:#8099b0;font-family:\'DM Mono\',monospace;">'+f.date+'</div>'
      +'<div style="display:flex;justify-content:center;"><button onclick="removePayFile('+fi+')" style="background:none;border:none;cursor:pointer;color:#c02020;font-size:12px;font-weight:700;padding:4px 8px;border-radius:4px;">\u2715</button></div>'
      +'</div>';
  });
  container.innerHTML=html;
}

function removePaySubFolder(si){
  var subs=payFolderSubs[currentPayFolderId]||[];
  subs.splice(si,1);
  renderPayFileList();
}
function updatePayFileToolbar(){
  var checked=document.querySelectorAll('.payf-row-check:checked');
  var one=checked.length===1, any=checked.length>0;
  function s(id,en){var b=document.getElementById(id);if(b){b.style.opacity=en?'1':'0.45';b.style.pointerEvents=en?'auto':'none';}}
  s('payfbtn-rename',    one);
  s('payfbtn-duplicate', any);
  s('payfbtn-move',      any);
  s('payfbtn-workflow',  any);
  s('payfbtn-status',    one);
  s('payfbtn-download',  any);
  s('payfbtn-delete',    any);
}

function getCheckedPayFileIdxs(){
  return Array.from(document.querySelectorAll('.payf-row-check:checked')).map(function(c){return parseInt(c.getAttribute('data-idx'));});
}

function openPayFileRenameModal(){
  var idxs=getCheckedPayFileIdxs();
  if(idxs.length!==1)return;
  var f=(payFolderFiles[currentPayFolderId]||[])[idxs[0]];
  if(!f)return;
  document.getElementById('rename-input').value=f.name;
  document.getElementById('rename-err').style.display='none';
  document.getElementById('rename-modal').setAttribute('data-id','payfile:'+idxs[0]);
  document.getElementById('rename-modal').style.display='flex';
  setTimeout(function(){document.getElementById('rename-input').focus();},80);
}

function duplicatePayFile(){
  var files=payFolderFiles[currentPayFolderId]||[];
  var idxs=getCheckedPayFileIdxs().sort(function(a,b){return b-a;});
  idxs.forEach(function(i){
    var f=files[i]; if(!f)return;
    var dot=f.name.lastIndexOf('.');
    var base=dot!==-1?f.name.slice(0,dot):f.name;
    var ext=dot!==-1?f.name.slice(dot):'';
    files.splice(i+1,0,{name:base+' (copy)'+ext,size:f.size,date:f.date});
  });
  document.getElementById('payf-check-all').checked=false;
  renderPayFileList();
}

function openPayFileMoveModal(){
  var idxs=getCheckedPayFileIdxs();
  var files=payFolderFiles[currentPayFolderId]||[];
  var names=idxs.map(function(i){return files[i]?files[i].name:'';}).filter(Boolean).join(', ');
  document.getElementById('move-dest').value='';
  document.getElementById('move-item-names').textContent=names;
  document.getElementById('move-modal').setAttribute('data-ctx','payfile');
  document.getElementById('move-modal').style.display='flex';
}

function openPayFileWorkflowModal(){
  var idxs=getCheckedPayFileIdxs();
  var files=payFolderFiles[currentPayFolderId]||[];
  var names=idxs.map(function(i){return files[i]?files[i].name:'';}).filter(Boolean).join(', ');
  openWfPicker(names);
}

async function openPayFileStatusModal(){
  var idxs=getCheckedPayFileIdxs();
  if(idxs.length!==1)return;
  var files=payFolderFiles[currentPayFolderId]||[];
  var file=files[idxs[0]];
  var fileName=file?file.name:'';
  document.getElementById('status-modal-subtitle').textContent=fileName;
  document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">Loading…</p>';
  document.getElementById('status-modal').style.display='flex';
  var q=sb.from('ged_workflow_instances').select('*').ilike('document_names','%'+fileName+'%');
  if(file&&file.created_at) q=q.gte('applied_at',file.created_at);
  var {data:instances}=await q.order('applied_at',{ascending:false});
  if(!instances||instances.length===0){
    document.getElementById('status-modal-body').innerHTML='<p style="font-size:13px;color:#8099b0;text-align:center;padding:24px 0;">No workflow has been applied to this file yet.</p>';
    return;
  }
  var ids=instances.map(function(i){return i.id;});
  var {data:allRecips}=await sb.from('ged_workflow_recipients').select('*').in('instance_id',ids);
  document.getElementById('status-modal-body').innerHTML=renderStatusInstances(instances,allRecips);
}

function downloadPayFile(){
  var idxs=getCheckedPayFileIdxs();
  var files=payFolderFiles[currentPayFolderId]||[];
  _downloadFileRefs=idxs.map(function(i){return files[i];}).filter(Boolean);
  var names=_downloadFileRefs.map(function(f){return f.name;});
  document.getElementById('download-names').innerHTML=names.map(function(n){
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(34,79,147,0.06);">'
      +'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a90d9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
      +'<span style="font-size:12px;color:#1a2a3a;">'+n+'</span></div>';
  }).join('');
  document.getElementById('download-modal').style.display='flex';
}
function toggleAllPayFiles(cb){
  document.querySelectorAll('.payf-row-check').forEach(function(c){c.checked=cb.checked;});
  updatePayFileToolbar();
}
async function handlePayFileInput(input){
  if(!payFolderFiles[currentPayFolderId]) payFolderFiles[currentPayFolderId]=[];
  var arr=Array.from(input.files);
  input.value='';
  showToast('Uploading '+arr.length+' file'+(arr.length===1?'':'s')+'…');
  for(var i=0;i<arr.length;i++){
    var rec=await gedUploadFile(arr[i],currentPayFolderId,'payment');
    if(rec) payFolderFiles[currentPayFolderId].push(rec);
  }
  renderPayFileList();
  showToast(arr.length+' file'+(arr.length===1?' uploaded':'s uploaded'));
}

// ── pay subfolders ────────────────────────────────────────────
var payFolderSubs={};   // keyed by folderId: [{id, name, date}]

function openNewPaySubFolderModal(){
  document.getElementById('new-pay-sub-input').value='';
  document.getElementById('new-pay-sub-err').style.display='none';
  document.getElementById('new-pay-sub-modal').style.display='flex';
  setTimeout(function(){document.getElementById('new-pay-sub-input').focus();},80);
}
function closeNewPaySubFolderModal(){document.getElementById('new-pay-sub-modal').style.display='none';}
function confirmNewPaySubFolder(){
  var val=document.getElementById('new-pay-sub-input').value.trim();
  if(!val){document.getElementById('new-pay-sub-err').textContent='Please enter a folder name.';document.getElementById('new-pay-sub-err').style.display='block';return;}
  if(!payFolderSubs[currentPayFolderId]) payFolderSubs[currentPayFolderId]=[];
  var today=new Date();
  var ds=('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  var subs=payFolderSubs[currentPayFolderId];
  var newId=Date.now();
  var newNum=subs.length?Math.max.apply(null,subs.map(function(s){return s.num||0;}))+1:1;
  subs.push({id:newId,num:newNum,name:val,date:ds});
  closeNewPaySubFolderModal();
  renderPayFileList();
  showToast('Folder "'+val+'" created');
}
function removePayFile(i){
  if(!payFolderFiles[currentPayFolderId])return;
  payFolderFiles[currentPayFolderId].splice(i,1);
  renderPayFileList();
}
async function deletePayFile(){
  var idxs=Array.from(document.querySelectorAll('.payf-row-check:checked')).map(function(c){return parseInt(c.getAttribute('data-idx'));}).sort(function(a,b){return b-a;});
  var files=payFolderFiles[currentPayFolderId]||[];
  var toDelete=idxs.map(function(i){return files[i];}).filter(Boolean);
  await gedDeleteFiles(toDelete);
  idxs.forEach(function(i){files.splice(i,1);});
  document.getElementById('payf-check-all').checked=false;
  renderPayFileList();
  showToast(idxs.length+' file'+(idxs.length===1?' deleted':'s deleted'));
}

// unified confirmRename: handles payfile, pay folder, file, and deliverable folder
confirmRename=function(){
  var rawId=document.getElementById('rename-modal').getAttribute('data-id')||'';
  var val=document.getElementById('rename-input').value.trim();
  if(!val){document.getElementById('rename-err').textContent='Please enter a name.';document.getElementById('rename-err').style.display='block';return;}
  if(rawId.indexOf('payfile:')===0){
    var idx=parseInt(rawId.replace('payfile:',''));
    var files=payFolderFiles[currentPayFolderId]||[];
    var pf=files[idx];
    if(pf){pf.name=val;if(pf.id)sb.from('ged_files').update({name:val}).eq('id',pf.id).then(function(){});}
    closeRenameModal();
    renderPayFileList();
  } else if(rawId.indexOf('pay:')===0){
    var id=parseInt(rawId.replace('pay:',''));
    var f=payFolders.find(function(x){return x.id===id;});
    if(f) f.name=val;
    closeRenameModal();
    renderPayFolders();
  } else if(rawId.indexOf('file:')===0){
    var fidx=parseInt(rawId.replace('file:',''));
    var ffiles=folderFiles[currentFolderId]||[];
    var ff=ffiles[fidx];
    if(ff){ff.name=val;if(ff.id)sb.from('ged_files').update({name:val}).eq('id',ff.id).then(function(){});}
    closeRenameModal();
    renderFolderFiles();
  } else {
    var rowId=parseInt(rawId);
    var d=deliverables.find(function(x){return x.id===rowId;});
    if(d){d.name=val;d.code='';}
    closeRenameModal();
    renderDeliverables();
  }
};
