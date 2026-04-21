// End-to-end user-like test using JSDOM
const fs=require('fs');
const path=require('path');
const {JSDOM}=require('C:/Users/jangs/AppData/Local/Temp/node_modules/jsdom');

const fail=[];
const pass=[];
function check(name,cond,extra){
    if(cond){pass.push(name);console.log('  ✓',name);}
    else {fail.push(name+(extra?' — '+extra:''));console.log('  ✗',name,extra||'');}
}

async function testFile(file){
    console.log('\n=== Testing '+file+' ===');
    const html=fs.readFileSync(path.join(__dirname,file),'utf8');
    const dom=new JSDOM(html,{
        runScripts:'outside-only',
        pretendToBeVisual:true,
        url:'https://jangs1424.github.io/habit-tracker/'+file
    });
    const w=dom.window;
    // Mock Supabase (script tag fails to load; stub the global)
    w.supabase={createClient:()=>null};
    // Mock localStorage
    const store={};
    Object.defineProperty(w,'localStorage',{value:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},writable:true});
    w.confirm=()=>true;
    w.alert=()=>{};

    // Extract script and run
    const scriptTags=dom.window.document.querySelectorAll('script:not([src])');
    let err=null;
    try {
        const allScript=Array.from(scriptTags).map(s=>s.textContent).join('\n')+'\n\n// expose for tests\nwindow.D=D;window.viewDate=viewDate;window.CAT_ICONS=CAT_ICONS;window.CELEBRATE_MESSAGES=CELEBRATE_MESSAGES;window.HABIT_TIME_FALLBACK=HABIT_TIME_FALLBACK;window.__setViewDate=(d)=>{viewDate=d;_userNavigatedDate=(d!==toLocalISO());};window.__setStaleVd=(d,nav)=>{viewDate=d;_userNavigatedDate=nav;};';
        w.eval(allScript);
    } catch(e){err=e;}
    check('JS executes without errors',!err,err&&err.message);

    // Wait for render
    await new Promise(r=>setTimeout(r,100));

    const doc=w.document;

    // TEST 1: Page loads with habits
    const list=doc.getElementById('habitList');
    check('habitList element exists',!!list);
    check('habits render (has habit-item children)',list&&list.querySelectorAll('.habit-item').length>0,'got '+(list?list.querySelectorAll('.habit-item').length:0));

    // TEST 2: Habit items have correct structure
    const firstHabit=list&&list.querySelector('.habit-item');
    if(firstHabit){
        check('habit has time pill',!!firstHabit.querySelector('.habit-time-pill'));
        check('habit has cat icon',!!firstHabit.querySelector('.habit-cat-icon'));
        check('habit has info',!!firstHabit.querySelector('.habit-item-info'));
        check('habit has name',!!firstHabit.querySelector('.habit-item-name'));
    }

    // TEST 3: Time pill shows HH:MM format (not "오전 9:30")
    const pills=list&&list.querySelectorAll('.habit-time-pill');
    if(pills&&pills.length){
        const firstTime=pills[0].textContent.trim();
        check('time pill shows HH:MM format',/^\d{2}:\d{2}$/.test(firstTime),'got "'+firstTime+'"');
    }

    // TEST 4: Today's date label
    const lab=doc.getElementById('dateNavLabel');
    if(lab){
        const today=w.toLocalISO();
        const expectedDate=new Date(today);
        const mo=expectedDate.getMonth()+1,da=expectedDate.getDate();
        check('date label shows today in Korean format',lab.textContent.includes((mo)+'월 '+da+'일'),'got "'+lab.textContent+'"');
        check('date label marks (오늘)',lab.textContent.includes('(오늘)'));
    }

    // TEST 5: Habits are sorted by time
    if(pills&&pills.length>1){
        const times=[...pills].map(p=>p.textContent.trim());
        const sorted=[...times].sort();
        check('habits sorted by time ascending',JSON.stringify(times)===JSON.stringify(sorted),'got '+times.slice(0,5).join(','));
    }

    // TEST 6: No work-block (should be split into work-part1/2)
    const hasWorkBlock=[...(list?list.querySelectorAll('.habit-item-name'):[])].some(n=>n.textContent.includes('업무 블록'));
    const hasPart1=[...(list?list.querySelectorAll('.habit-item-name'):[])].some(n=>n.textContent.includes('업무 파트1'));
    const hasPart2=[...(list?list.querySelectorAll('.habit-item-name'):[])].some(n=>n.textContent.includes('업무 파트2'));
    check('no old "업무 블록" habit',!hasWorkBlock);

    // TEST 7: Simulate checking a habit
    const firstCheck=list&&list.querySelector('.habit-check');
    if(firstCheck&&firstCheck.onclick){
        const xpBefore=w.D.xp;
        firstCheck.click();
        await new Promise(r=>setTimeout(r,50));
        check('checking habit increases XP by 10',w.D.xp===xpBefore+10,'before='+xpBefore+' after='+w.D.xp);
    }

    // TEST 8: Test resetHabitTimes function
    if(typeof w.resetHabitTimes==='function'){
        // Mess up all times
        w.D.habits.forEach(h=>h.time='06:14');
        w.resetHabitTimes();
        const morning=w.D.habits.find(h=>h.id==='morning');
        check('resetHabitTimes restores morning to 09:00',morning&&morning.time==='09:00','got '+(morning&&morning.time));
        const reading=w.D.habits.find(h=>h.id==='reading');
        check('resetHabitTimes restores reading to 20:00',reading&&reading.time==='20:00','got '+(reading&&reading.time));
    } else {
        check('resetHabitTimes function defined',false,'function missing');
    }

    // TEST 9: Open time-edit modal
    const modalOverlay=doc.getElementById('modalOverlay');
    if(typeof w.editHabitTime==='function'){
        w.editHabitTime('meditation');
        await new Promise(r=>setTimeout(r,50));
        check('time-edit modal opens',modalOverlay.classList.contains('show'));
        const modalContent=doc.getElementById('modalContent');
        check('modal contains "시간 수정"',modalContent&&modalContent.textContent.includes('시간 수정'));
        check('modal has "지금 시간" button',modalContent&&modalContent.textContent.includes('지금 시간'));
        check('modal has time input',!!modalContent.querySelector('#mTimeEditInput'));
        w.closeModal();
    }

    // TEST 10: Open book picker modal
    if(typeof w.openModal==='function'){
        if(!w.D.books)w.D.books=[];
        w.D.books=['원씽','돈의 속성','아주 작은 습관의 힘'];
        w.openModal('pickBook');
        await new Promise(r=>setTimeout(r,50));
        const modalContent=doc.getElementById('modalContent');
        check('book picker modal opens',modalOverlay.classList.contains('show'));
        check('book picker shows all 3 books',modalContent&&modalContent.querySelectorAll('.book-pick-row').length===3);
        check('book picker has add input',!!modalContent.querySelector('#mBookAddInput'));
        // Select a book
        if(typeof w._selectBook==='function'){
            w._selectBook(1);
            check('selecting book sets currentBook',w.D.currentBook===1,'got '+w.D.currentBook);
            check('modal closes after selection',!modalOverlay.classList.contains('show'));
        }
    }

    // TEST 11: Open date picker modal
    if(typeof w.pickDate==='function'){
        w.pickDate();
        await new Promise(r=>setTimeout(r,50));
        const modalContent=doc.getElementById('modalContent');
        check('date picker modal opens',modalOverlay.classList.contains('show'));
        check('date picker has date input',!!modalContent.querySelector('#mDatePickInput'));
        w.closeModal();
    }

    // TEST 12: viewDate navigation (read via vd() since let is not live-bound to window)
    if(typeof w.changeViewDate==='function'){
        const before=w.vd();
        w.changeViewDate(-1);
        const after=w.vd();
        check('changeViewDate(-1) moves to yesterday',after<before,'before='+before+' after='+after);
        w.goToday();
        check('goToday resets to today',w.vd()===w.toLocalISO());
    }

    // TEST 12b: day rollover — if user hasn't navigated, viewDate auto-updates to today
    if(typeof w.maybeRollViewDate==='function'){
        // Simulate stale viewDate (no nav) — date rolled over while app open
        w.__setStaleVd('2020-01-01',false);
        w.maybeRollViewDate();
        check('maybeRollViewDate auto-updates stale viewDate when not navigated',w.vd()===w.toLocalISO(),'got '+w.vd());
        // User-navigated past date: preserved
        w.__setStaleVd('2020-01-01',true);
        w.maybeRollViewDate();
        check('maybeRollViewDate preserves viewDate when user navigated',w.vd()==='2020-01-01','got '+w.vd());
        w.goToday();
    }

    // TEST 13: Settings renders
    if(typeof w.renderSettings==='function'){
        w.renderSettings();
        const hm=doc.getElementById('habitManager');
        check('settings habit manager renders',hm&&hm.children.length>0);
        check('settings shows reset level button',doc.body.innerHTML.includes('레벨 1로 초기화'));
        check('settings shows reset times button',doc.body.innerHTML.includes('기본 시간으로 복원'));
        check('settings shows books section',doc.body.innerHTML.includes('읽는 책'));
        check('version label v2026-04-22-a present',doc.body.innerHTML.includes('v2026-04-22-a'));
    }

    // TEST 14: CAT_ICONS has all expected categories
    const expectedCats=['몸','스킬','콘텐츠','수익','마인드','성장','생활','집안일','라이프'];
    expectedCats.forEach(c=>{
        check('CAT_ICONS has "'+c+'"',!!w.CAT_ICONS[c],'got '+w.CAT_ICONS[c]);
    });

    // TEST 15: CELEBRATE_MESSAGES warm tone check
    expectedCats.forEach(c=>{
        const msgs=w.CELEBRATE_MESSAGES&&w.CELEBRATE_MESSAGES[c];
        if(msgs){
            const hasSlang=msgs.some(m=>/쌉|\+1|미션 클리어|파이프라인/.test(m));
            check('CELEBRATE_MESSAGES['+c+'] no slang/game terms',!hasSlang);
        }
    });

    // TEST 16: Per-habit videos via saveHabitVideo
    if(typeof w.saveHabitVideo==='function'){
        const workoutIdx=w.D.habits.findIndex(h=>h.id==='workout');
        w.saveHabitVideo(workoutIdx,1,'url','https://youtube.com/watch?v=test');
        w.saveHabitVideo(workoutIdx,1,'kw','상체');
        const workout=w.D.habits[workoutIdx];
        check('saveHabitVideo stores url+kw on habit',workout.videos&&workout.videos[1]&&workout.videos[1].url==='https://youtube.com/watch?v=test'&&workout.videos[1].kw==='상체');
        // Empty both fields should delete entry
        w.saveHabitVideo(workoutIdx,1,'url','');
        w.saveHabitVideo(workoutIdx,1,'kw','');
        check('empty video fields removes entry',!workout.videos[1]);
    }

    // TEST 17: Edit modal — workout habit shows video section with h.days rows only
    if(typeof w.openModal==='function'){
        const workoutIdx=w.D.habits.findIndex(h=>h.id==='workout');
        const workoutDays=w.D.habits[workoutIdx].days;
        w.openModal('editHabit',workoutIdx);
        await new Promise(r=>setTimeout(r,50));
        const mc=doc.getElementById('modalContent');
        check('workout edit modal shows 요일별 영상 section',mc&&mc.textContent.includes('요일별 영상'));
        check('workout edit modal has rows equal to h.days count',mc&&mc.querySelectorAll('.day-video-item').length===workoutDays.length,'got '+(mc?mc.querySelectorAll('.day-video-item').length:0)+' expected '+workoutDays.length);
        w.closeModal();

        // Other habits should NOT show video section
        const runningIdx=w.D.habits.findIndex(h=>h.id==='running');
        if(runningIdx>=0){
            w.openModal('editHabit',runningIdx);
            await new Promise(r=>setTimeout(r,50));
            const mc2=doc.getElementById('modalContent');
            check('running edit modal does NOT show 요일별 영상 section',mc2&&!mc2.textContent.includes('요일별 영상'));
            w.closeModal();
        }
        const engIdx=w.D.habits.findIndex(h=>h.id==='english-shadow');
        if(engIdx>=0){
            w.openModal('editHabit',engIdx);
            await new Promise(r=>setTimeout(r,50));
            const mc3=doc.getElementById('modalContent');
            check('english-shadow edit modal does NOT show 요일별 영상 section',mc3&&!mc3.textContent.includes('요일별 영상'));
            w.closeModal();
        }
    }

    // TEST 17b: toggleEditDay live updates video section rows
    if(typeof w.toggleEditDay==='function'&&typeof w.openModal==='function'){
        const workoutIdx=w.D.habits.findIndex(h=>h.id==='workout');
        // Reset to [1,3,5]
        w.D.habits[workoutIdx].days=[1,3,5];
        w.openModal('editHabit',workoutIdx);
        await new Promise(r=>setTimeout(r,50));
        const sec=doc.getElementById('mEditVideosSection');
        const beforeCount=sec?sec.querySelectorAll('.day-video-item').length:0;
        check('before toggle — 3 video rows (monday/wed/fri)',beforeCount===3,'got '+beforeCount);
        // Find Thursday toggle (data-day=4) and simulate click
        const thuToggle=doc.querySelector('#mEditDays .day-toggle[data-day="4"]');
        if(thuToggle){
            w.toggleEditDay(workoutIdx,4,thuToggle);
            const afterCount=doc.getElementById('mEditVideosSection').querySelectorAll('.day-video-item').length;
            check('after adding Thursday — 4 video rows',afterCount===4,'got '+afterCount);
            check('h.days updated with Thursday',w.D.habits[workoutIdx].days.includes(4));
            // Remove Thursday
            w.toggleEditDay(workoutIdx,4,thuToggle);
            const afterRemoveCount=doc.getElementById('mEditVideosSection').querySelectorAll('.day-video-item').length;
            check('after removing Thursday — 3 video rows',afterRemoveCount===3,'got '+afterRemoveCount);
        }
        w.closeModal();
    }

    // TEST 18: Workout chip visibility (only when set, only on workout habit)
    const mondayDate='2026-04-20';
    if(new Date(mondayDate).getDay()===1){
        w.__setViewDate(mondayDate);
        const workoutIdx=w.D.habits.findIndex(h=>h.id==='workout');
        if(w.D.habits[workoutIdx].videos)delete w.D.habits[workoutIdx].videos;
        w.render();
        await new Promise(r=>setTimeout(r,50));
        let chips=list.querySelectorAll('.habit-chip');
        let hasKw=[...chips].some(c=>c.textContent.includes('상체 30분'));
        check('no chip on workout when video unset',!hasKw);
        // Set for Monday
        w.saveHabitVideo(workoutIdx,1,'url','https://youtube.com/a');
        w.saveHabitVideo(workoutIdx,1,'kw','상체 30분');
        w.render();
        await new Promise(r=>setTimeout(r,50));
        chips=list.querySelectorAll('.habit-chip');
        hasKw=[...chips].some(c=>c.textContent.includes('상체 30분'));
        check('chip appears on workout when video set for Monday',hasKw,'chips: '+[...chips].map(c=>c.textContent).join('|'));
    }
    // Tuesday - running should not show video chip even if videos were set somehow
    const tuesdayDate='2026-04-21';
    if(new Date(tuesdayDate).getDay()===2){
        w.__setViewDate(tuesdayDate);
        const runningIdx=w.D.habits.findIndex(h=>h.id==='running');
        if(runningIdx>=0){
            w.D.habits[runningIdx].videos={2:{url:'https://legacy',kw:'러닝'}};
            w.render();
            await new Promise(r=>setTimeout(r,50));
            const chips=list.querySelectorAll('.habit-chip');
            const hasRunning=[...chips].some(c=>c.textContent.includes('러닝'));
            check('running habit does NOT render video chip (workout-only rule)',!hasRunning);
        }
    }
    w.goToday();

    // TEST 19: Settings no longer has "요일별 운동 영상" card
    if(typeof w.renderSettings==='function'){
        w.renderSettings();
        check('settings removed 요일별 운동 영상 card (moved to habit edit)',!doc.body.innerHTML.includes('🎬 요일별 운동 영상'));
    }

    // TEST 20: Daily task CRUD
    if(typeof w.addDailyTask==='function'){
        const inp=doc.getElementById('newTaskName');
        const ti=doc.getElementById('newTaskTime');
        if(inp&&ti){
            inp.value='미팅 준비';ti.value='14:00';
            w.addDailyTask();
            const today=w.vd();
            const tasks=w.D.dailyTasks[today]||[];
            check('addDailyTask creates task',tasks.length===1&&tasks[0].name==='미팅 준비');
        }
    }

    console.log('\nResult for '+file+': '+pass.length+' passed, '+fail.length+' failed');
    return {pass:pass.length,fail:fail.length};
}

(async()=>{
    console.log('='.repeat(60));
    console.log('USER-LIKE END-TO-END TEST');
    console.log('='.repeat(60));
    const r1=await testFile('garden-version.html');
    pass.length=0;fail.length=0;
    const r2=await testFile('index.html');

    console.log('\n'+'='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('garden-version.html: '+r1.pass+' passed, '+r1.fail+' failed');
    console.log('index.html: '+r2.pass+' passed, '+r2.fail+' failed');
    if(r1.fail===0&&r2.fail===0){
        console.log('\n✅ ALL TESTS PASS');
    } else {
        console.log('\n❌ SOME TESTS FAIL');
        process.exit(1);
    }
})();
