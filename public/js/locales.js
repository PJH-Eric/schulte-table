/* ===== locales.js — 繁體中文（預設）／简体中文／English =====
 * 每個 key 一列：[繁中, 简中, English]，三語一起維護，不會漏翻。
 */
(function (root) {
  'use strict';
  var T = {
    'doc.title': ['舒爾特方格｜免費線上專注力訓練・手機平板都能玩', '舒尔特方格｜免费在线专注力训练・手机平板都能玩', 'Schulte Table | Free Online Focus Training Game'],
    'doc.desc': ['免費免下載的舒爾特方格專注力訓練：依序點完數字、注音、英文字母或圖案。六段難度、闖關 60 關、每日挑戰，也能線上多人同盤搶點或同題競速。',
      '免费免下载的舒尔特方格专注力训练：依序点完数字、注音、英文字母或图案。六段难度、经典／逆序／随机、闯关 60 关、每日挑战，也能在线多人同盘抢点或同题竞速，手机平板都能玩。',
      'A free Schulte table focus game: tap numbers, Zhuyin, letters or fruit & animal pictures in order. Six difficulties, classic, reverse and random modes, 60 levels, daily challenges, plus online grab and race matches.'],

    'common.close': ['關閉', '关闭', 'Close'], 'common.cancel': ['取消', '取消', 'Cancel'], 'common.done': ['完成', '完成', 'Done'],
    'common.on': ['開', '开', 'On'], 'common.off': ['關', '关', 'Off'], 'common.ok': ['確定', '确定', 'OK'],

    'top.lobby': ['遊戲大廳', '游戏大厅', 'Game Hub'], 'top.back': ['返回', '返回', 'Back'], 'top.side': ['對局資訊', '对局信息', 'Match info'],
    'top.pause': ['暫停', '暂停', 'Pause'], 'top.lang': ['語言', '语言', 'Language'], 'top.settings': ['設定', '设置', 'Settings'],
    'lang.zh-Hant': ['繁體中文', '繁體中文', '繁體中文'], 'lang.zh-Hans': ['简体中文', '简体中文', '简体中文'], 'lang.en': ['English', 'English', 'English'],

    'title.home': ['舒爾特方格', '舒尔特方格', 'Schulte Table'], 'title.solo': ['單機模式', '单机模式', 'Solo modes'], 'title.setup': ['選擇內容與難度', '选择内容与难度', 'Pick content & difficulty'],
    'title.levels': ['闖關', '闯关', 'Levels'], 'title.daily': ['每日挑戰', '每日挑战', 'Daily challenge'], 'title.records': ['我的紀錄', '我的记录', 'My records'],
    'title.help': ['怎麼玩', '怎么玩', 'How to play'], 'title.lobby': ['線上大廳', '在线大厅', 'Online lobby'], 'title.room': ['房間', '房间', 'Room'], 'title.game': ['遊戲', '游戏', 'Game'],

    'home.title': ['舒爾特方格', '舒尔特方格', 'Schulte Table'],
    'home.tagline': ['依序點完方格，練出好專注', '依序点完方格，练出好专注', 'Tap them in order. Train your focus.'],
    'home.menu': ['主選單', '主菜单', 'Main menu'],
    'home.solo': ['單機挑戰', '单机挑战', 'Play solo'], 'home.soloSub': ['經典、逆序、隨機、闖關、每日', '经典、逆序、随机、闯关、每日', 'Classic, reverse, random, levels, daily'],
    'home.online': ['線上對戰', '在线对战', 'Play online'], 'home.onlineSub': ['同盤搶點・同題競速・觀戰', '同盘抢点・同题竞速・观战', 'Grab, race and spectate'],
    'home.records': ['我的紀錄', '我的记录', 'My records'], 'home.recordsSub': ['已完成 {n} 局・最佳時間與星數', '已完成 {n} 局・最佳时间与星数', '{n} games played · bests & stars'],
    'home.help': ['怎麼玩', '怎么玩', 'How to play'], 'home.helpSub': ['規則、內容種類與計分', '规则、内容种类与计分', 'Rules, content types and scoring'],

    'mode.classic': ['經典計時', '经典计时', 'Classic'], 'mode.reverse': ['逆序模式', '逆序模式', 'Reverse'], 'mode.random': ['隨機模式', '随机模式', 'Random'],
    'mode.level': ['闖關', '闯关', 'Levels'], 'mode.daily': ['每日挑戰', '每日挑战', 'Daily'],
    'solo.classicSub': ['從頭點到尾，挑戰最快時間', '从头点到尾，挑战最快时间', 'First to last, as fast as you can'],
    'solo.reverseSub': ['從最後一個倒著點回第一個', '从最后一个倒着点回第一个', 'Start from the last and count down'],
    'solo.randomSub': ['只選難度，內容與順序隨機抽', '只选难度，内容与顺序随机抽', 'Pick a difficulty; content and order are drawn'],
    'solo.levelSub': ['60 關・已得 {s} 星・可玩到第 {n} 關', '60 关・已得 {s} 星・可玩到第 {n} 关', '60 levels · {s} stars · up to level {n}'],
    'solo.dailySub': ['六個難度各一題・今天完成 {n}/6', '六个难度各一题・今天完成 {n}/6', 'One board per difficulty · {n}/6 done today'],

    'content.number': ['數字', '数字', 'Numbers'], 'content.zhuyin': ['注音', '注音', 'Zhuyin'], 'content.letter': ['英文字母', '英文字母', 'Letters'], 'content.icon': ['圖案', '图案', 'Pictures'],
    'order.asc': ['正序', '正序', 'Forward'], 'order.desc': ['逆序', '逆序', 'Reverse'],
    'tier.kid': ['幼幼班', '幼幼班', 'Tiny'], 'tier.easy': ['簡單', '简单', 'Easy'], 'tier.normal': ['普通', '普通', 'Normal'], 'tier.hard': ['困難', '困难', 'Hard'], 'tier.myth': ['神話', '神话', 'Mythic'], 'tier.king': ['王者', '王者', 'King'],
    'theme.wood': ['木質麻將牌', '木质麻将牌', 'Wooden tiles'], 'theme.candy': ['糖果彩虹', '糖果彩虹', 'Candy rainbow'], 'theme.tech': ['科技深色', '科技深色', 'Tech dark'],

    'setup.content': ['內容', '内容', 'Content'], 'setup.tier': ['難度', '难度', 'Difficulty'],
    'setup.classicSub': ['依序點完所有格子，越快越好。', '依序点完所有格子，越快越好。', 'Tap every cell in order, as fast as you can.'],
    'setup.reverseSub': ['從最大（最後）倒著點回最小（第一個）。', '从最大（最后）倒着点回最小（第一个）。', 'Go from the biggest (last) back to the smallest (first).'],
    'setup.randomSub': ['選好難度，系統幫你抽內容與順序。', '选好难度，系统帮你抽内容与顺序。', 'Choose a difficulty and we draw the content and order.'],
    'setup.randomPool': ['這個難度可能抽到：{list}（正序或逆序）', '这个难度可能抽到：{list}（正序或逆序）', 'Possible draws: {list} (forward or reverse)'],
    'setup.best': ['這個組合的最佳：', '这个组合的最佳：', 'Best for this combo:'], 'setup.start': ['開始', '开始', 'Start'], 'setup.draw': ['抽一局', '抽一局', 'Draw & play'],
    'setup.randomCount': ['隨機模式已完成 {n} 局', '随机模式已完成 {n} 局', '{n} random games finished'],

    'levels.stars': ['總星數 {s}/{m}', '总星数 {s}/{m}', 'Stars {s}/{m}'], 'levels.range': ['第 {a}～{b} 關', '第 {a}～{b} 关', 'Levels {a}–{b}'],
    'levels.aria': ['第 {n} 關，{s} 星', '第 {n} 关，{s} 星', 'Level {n}, {s} stars'], 'levels.locked': ['尚未解鎖', '尚未解锁', 'locked'],
    'levels.lockedToast': ['先通過前一關才能玩這關', '先通过前一关才能玩这关', 'Clear the previous level first'],

    'daily.today': ['今天（台北時間）{d}', '今天（台北时间）{d}', 'Today (Taipei time) {d}'], 'daily.streak': ['連續 {n} 天', '连续 {n} 天', '{n}-day streak'],
    'daily.days': ['{n} 天', '{n} 天', '{n} days'], 'daily.play': ['挑戰', '挑战', 'Play'], 'daily.calendar': ['本月完成紀錄', '本月完成记录', 'This month'],
    'daily.doneN': ['完成 {n} 題', '完成 {n} 题', '{n} done'],
    'daily.rule': ['每天每個難度只有第一次成績計入，之後可以練習。', '每天每个难度只有第一次成绩计入，之后可以练习。', 'Only your first try per difficulty counts each day; replays are practice.'],
    'cal.week': ['日,一,二,三,四,五,六', '日,一,二,三,四,五,六', 'S,M,T,W,T,F,S'],

    'rec.soloGames': ['單機完成', '单机完成', 'Solo games'], 'rec.randomGames': ['隨機完成', '随机完成', 'Random games'], 'rec.levelStars': ['闖關星數', '闯关星数', 'Level stars'],
    'rec.streak': ['每日連續', '每日连续', 'Daily streak'], 'rec.best': ['最佳時間', '最佳时间', 'Best times'], 'rec.tier': ['難度', '难度', 'Difficulty'],
    'rec.online': ['線上戰績', '在线战绩', 'Online'], 'rec.gw': ['{g} 局・勝 {w}', '{g} 局・胜 {w}', '{g} played · {w} won'],
    'rec.clear': ['清除所有紀錄', '清除所有记录', 'Clear all records'], 'rec.clearConfirm': ['最佳時間、闖關星數、每日挑戰與線上戰績都會刪除，設定會保留。確定嗎？', '最佳时间、闯关星数、每日挑战与在线战绩都会删除，设置会保留。确定吗？', 'Best times, level stars, daily results and online stats will be deleted. Settings stay. Continue?'],
    'rec.clearOk': ['全部清除', '全部清除', 'Clear all'], 'rec.cleared': ['紀錄已清除', '记录已清除', 'Records cleared'],
    'rec.noStorage': ['這個瀏覽器不能存檔，關掉頁面後紀錄會消失。', '这个浏览器不能存档，关掉页面后记录会消失。', 'This browser cannot save data; records vanish when you close the page.'],
    'online.grab': ['同盤搶點', '同盘抢点', 'Grab'], 'online.race': ['同題競速', '同题竞速', 'Race'],

    'help.goalH': ['目標', '目标', 'Goal'],
    'help.goal1': ['方格裡的內容被打亂了。從第一個開始，依照順序一格一格點下去，點完全部就完成。', '方格里的内容被打乱了。从第一个开始，依照顺序一格一格点下去，点完全部就完成。', 'The cells are shuffled. Starting from the first, tap them one by one in order until every cell is done.'],
    'help.goal2': ['點對的格子會變暗但留在原位；頂列會顯示「下一個」（可以在設定關掉）。', '点对的格子会变暗但留在原位；顶栏会显示「下一个」（可以在设置关掉）。', 'Correct cells dim but stay in place. The top bar shows what comes next (you can turn this off).'],
    'help.goal3': ['點錯沒有懲罰，只會輕輕抖一下，不扣分也不加時間。', '点错没有惩罚，只会轻轻抖一下，不扣分也不加时间。', 'Wrong taps are never penalised — the cell just wiggles.'],
    'help.contentH': ['四種內容', '四种内容', 'Four kinds of content'],
    'help.contentMax': ['最大 {n}×{n}', '最大 {n}×{n}', 'Up to {n}×{n}'],
    'help.seq.number': ['1、2、3…', '1、2、3…', '1, 2, 3…'], 'help.seq.zhuyin': ['ㄅ、ㄆ、ㄇ…', 'ㄅ、ㄆ、ㄇ…', 'ㄅ, ㄆ, ㄇ…'], 'help.seq.letter': ['A、B、C…', 'A、B、C…', 'A, B, C…'],
    'help.seq.icon': ['1 個、2 個、3 個…（水果、動物照數量點）', '1 个、2 个、3 个…（水果、动物照数量点）', '1, 2, 3… (count the fruits and animals)'],
    'help.contentNote': ['圖案只比「數量」：每格畫的水果或動物不一樣，看有幾個就好。7 個以上會排成每列 5 個。', '图案只比「数量」：每格画的水果或动物不一样，看有几个就好。7 个以上会排成每行 5 个。', 'Pictures are about the count only — each cell shows a different fruit or animal, just count them. From 7 up they line up in rows of five.'],
    'help.tierH': ['六段難度與逆序', '六段难度与逆序', 'Difficulties and reverse'],
    'help.tierNote': ['大盤面放不下的內容不會出現在選單裡。', '大盘面放不下的内容不会出现在菜单里。', 'Content that does not fit a large board is simply not offered there.'],
    'help.reverse': ['逆序就是倒著點：數字從大到小、注音與字母倒回ㄅ和 A（最高難度從ㄦ、Z 開始）、圖案由多到少。', '逆序就是倒着点：数字从大到小、注音与字母倒回ㄅ和 A（最高难度从ㄦ、Z 开始）、图案由多到少。', 'Reverse means counting down: big to small numbers, back to ㄅ and A (from ㄦ and Z at the top level), most pictures to fewest.'],
    'help.soloH': ['單機模式', '单机模式', 'Solo modes'],
    'help.mode.classic': ['選內容與難度，挑戰最快時間。', '选内容与难度，挑战最快时间。', 'Pick content and difficulty; chase your best time.'],
    'help.mode.reverse': ['和經典一樣，但倒著點，紀錄分開存。', '和经典一样，但倒着点，记录分开存。', 'Like classic but backwards; records are kept separately.'],
    'help.mode.random': ['只選難度，內容與順序隨機抽，成績和經典、逆序共用最佳紀錄。', '只选难度，内容与顺序随机抽，成绩和经典、逆序共用最佳记录。', 'Pick a difficulty; content and order are drawn. Shares best times with classic and reverse.'],
    'help.mode.level': ['60 關，每 10 關換一段難度；越後面顏色和大小越亂。每關 1～3 星。', '60 关，每 10 关换一段难度；越后面颜色和大小越乱。每关 1～3 星。', '60 levels; every 10 the board grows, and colours and sizes get messier. 1–3 stars each.'],
    'help.mode.daily': ['每天六個難度各一題（台北時間換日），只算第一次。', '每天六个难度各一题（台北时间换日），只算第一次。', 'Six boards a day (Taipei time); only your first try counts.'],
    'help.kid': ['幼幼班 3×3 格子最大；單機連續點錯 3 次，正確的格子會輕輕閃動提示。', '幼幼班 3×3 格子最大；单机连续点错 3 次，正确的格子会轻轻闪动提示。', 'Tiny 3×3 has the biggest cells; after 3 wrong taps in a row (solo) the right cell gently blinks.'],
    'help.grabH': ['線上：同盤搶點', '在线：同盘抢点', 'Online: Grab'],
    'help.grab1': ['所有人共用同一盤、同一個「下一個」。誰先點到誰得分，目標就換成下一個。', '所有人共用同一盘、同一个「下一个」。谁先点到谁得分，目标就换成下一个。', 'Everyone shares one board and one target. Whoever taps it first scores, then the target moves on.'],
    'help.grab2': ['連續搶到會有連擊加成，被別人搶走一格連擊就歸零：', '连续抢到会有连击加成，被别人抢走一格连击就归零：', 'Grabbing in a row builds a combo; losing one cell resets it:'],
    'help.comboCol': ['連擊', '连击', 'Combo'], 'help.ptsCol': ['每格得分', '每格得分', 'Points per cell'],
    'help.raceH': ['線上：同題競速', '在线：同题竞速', 'Online: Race'],
    'help.race1': ['每個人各一盤、排列完全一樣，各自點自己的。看得到對手的進度條，看不到對手的盤面。', '每个人各一盘、排列完全一样，各自点自己的。看得到对手的进度条，看不到对手的盘面。', 'Everyone gets the same layout on their own board. You see rivals’ progress bars, not their boards.'],
    'help.race2': ['第一個點完的人勝，該局立刻結束；其他人依進度排名，進度相同並列。', '第一个点完的人胜，该局立刻结束；其他人依进度排名，进度相同并列。', 'The first to finish wins and the round ends; others rank by progress, ties share a place.'],
    'help.rankH': ['局數與名次分', '局数与名次分', 'Rounds and placing points'],
    'help.rank1': ['房主可選 1／3／5 局。每局依名次拿名次分＝人數 − 名次 ＋ 1，並列同分。', '房主可选 1／3／5 局。每局依名次拿名次分＝人数 − 名次 ＋ 1，并列同分。', 'The host picks 1, 3 or 5 rounds. Each round gives placing points = players − place + 1; ties score the same.'],
    'help.rank2': ['名次分最高者勝；平手時比總得分（搶點）或總耗時（競速）。', '名次分最高者胜；平手时比总得分（抢点）或总耗时（竞速）。', 'Most placing points wins; ties go to total score (grab) or total time (race).'],
    'help.keysH': ['鍵盤操作', '键盘操作', 'Keyboard'],
    'help.keys1': ['方向鍵移動焦點，Enter 或空白鍵點選；Esc 暫停（單機）。', '方向键移动焦点，Enter 或空格键点选；Esc 暂停（单机）。', 'Arrow keys move the focus, Enter or Space taps, Esc pauses (solo).'],
    'help.keys2': ['滑鼠和觸控是「按下就算」，不用等放開。', '鼠标和触控是「按下就算」，不用等放开。', 'Mouse and touch count the moment you press down.'],
    'help.font': ['數字、字母與注音字形來自 Noto Sans TC（SIL Open Font License 1.1）。', '数字、字母与注音字形来自 Noto Sans TC（SIL Open Font License 1.1）。', 'Digits, letters and Zhuyin glyphs from Noto Sans TC (SIL Open Font License 1.1).'],

    'set.title': ['設定', '设置', 'Settings'], 'set.sound': ['聲音', '声音', 'Sound'], 'set.bgm': ['背景音樂', '背景音乐', 'Music'], 'set.bgmVol': ['背景音樂音量', '背景音乐音量', 'Music volume'],
    'set.sfx': ['音效', '音效', 'Sound effects'], 'set.sfxVol': ['音效音量', '音效音量', 'Effects volume'],
    'set.look': ['外觀與語言', '外观与语言', 'Look & language'], 'set.theme': ['主題', '主题', 'Theme'], 'set.themeSub': ['格子、按鈕與音效一起換', '格子、按钮与音效一起换', 'Changes tiles, buttons and sounds'],
    'set.lang': ['語言', '语言', 'Language'], 'set.play': ['遊戲', '游戏', 'Gameplay'],
    'set.next': ['顯示「下一個」', '显示「下一个」', 'Show “next”'], 'set.nextSub': ['頂列提示下一個要點什麼', '顶栏提示下一个要点什么', 'The top bar shows what to tap next'],
    'set.vibrate': ['震動', '震动', 'Vibration'], 'set.vibrateSub': ['點錯時短震（裝置支援時）', '点错时短震（设备支持时）', 'Short buzz on a wrong tap (if supported)'],
    'set.motion': ['減少動態', '减少动态', 'Reduce motion'], 'set.motionSub': ['取消抖動與彈跳，只保留顏色變化', '取消抖动与弹跳，只保留颜色变化', 'No wiggles or bounces, colour changes only'],
    'set.assist': ['色彩輔助', '色彩辅助', 'Colour assist'], 'set.assistSub': ['玩家標記放大，搭配形狀辨識', '玩家标记放大，搭配形状辨识', 'Bigger player marks with shapes'],
    'set.reset': ['恢復預設', '恢复默认', 'Reset defaults'],

    'side.aria': ['對局資訊與聊天', '对局信息与聊天', 'Match info and chat'], 'side.summary': ['對局資訊', '对局信息', 'Match info'],
    'sum.mode': ['模式', '模式', 'Mode'], 'sum.tier': ['難度', '难度', 'Difficulty'], 'sum.content': ['內容', '内容', 'Content'], 'sum.order': ['順序', '顺序', 'Order'],
    'sum.misses': ['點錯', '点错', 'Misses'], 'sum.target': ['3 星目標', '3 星目标', '3-star target'], 'sum.best': ['最佳', '最佳', 'Best'],
    'sum.daily': ['每日成績', '每日成绩', 'Daily result'], 'sum.dailyCounts': ['這次會計入', '这次会计入', 'This try counts'], 'sum.dailyPractice': ['練習（不計入）', '练习（不计入）', 'Practice (not counted)'],
    'sum.kidTip': ['連續點錯 3 次，正確的格子會閃動提示。', '连续点错 3 次，正确的格子会闪动提示。', 'Miss 3 times in a row and the right cell blinks.'],
    'sum.keys': ['方向鍵移動、Enter 點選、Esc 暫停', '方向键移动、Enter 点选、Esc 暂停', 'Arrows move · Enter taps · Esc pauses'],

    'hud.next': ['下一個', '下一个', 'Next'], 'hud.progressAria': ['進度 {k}／{n}', '进度 {k}／{n}', 'Progress {k} of {n}'], 'hud.allDone': ['全部完成', '全部完成', 'All done'],
    'hud.scores': ['分數', '分数', 'Scores'], 'hud.race': ['大家的進度', '大家的进度', 'Everyone’s progress'], 'hud.watching': ['觀戰中', '观战中', 'Spectating'],
    'board.done': ['已點', '已点', 'done'],
    'cd.go': ['開始！', '开始！', 'Go!'],
    'game.levelTitle': ['闖關・第 {n} 關', '闯关・第 {n} 关', 'Level {n}'],
    'draw.title': ['抽籤中…', '抽签中…', 'Drawing…'],
    'pause.title': ['暫停中', '暂停中', 'Paused'], 'pause.sub': ['盤面先藏起來，計時已凍結。', '盘面先藏起来，计时已冻结。', 'The board is hidden and the clock is frozen.'],
    'pause.resume': ['繼續', '继续', 'Resume'], 'pause.restart': ['重新開始', '重新开始', 'Restart'], 'pause.home': ['回首頁', '回首页', 'Home'],

    'res.doneTitle': ['完成！', '完成！', 'Finished!'], 'res.recordTitle': ['新紀錄！', '新纪录！', 'New record!'], 'res.levelClear': ['第 {n} 關通過！', '第 {n} 关通过！', 'Level {n} cleared!'],
    'res.time': ['用時', '用时', 'Time'], 'res.misses': ['點錯', '点错', 'Misses'], 'res.best': ['這個組合最佳', '这个组合最佳', 'Best for this combo'],
    'res.target': ['3 星目標', '3 星目标', '3-star target'], 'res.levelBest': ['本關最佳', '本关最佳', 'Level best'], 'res.newBest': ['破紀錄', '破纪录', 'New best'],
    'res.practice': ['練習：不計入每日成績', '练习：不计入每日成绩', 'Practice: not counted'], 'res.dailyStreak': ['每日連續', '每日连续', 'Daily streak'],
    'res.randomCount': ['隨機完成局數', '随机完成局数', 'Random games'], 'res.starsAria': ['{n} 顆星', '{n} 颗星', '{n} stars'],
    'res.again': ['再來一局', '再来一局', 'Play again'], 'res.redraw': ['再抽一局', '再抽一局', 'Draw again'], 'res.retry': ['再玩一次', '再玩一次', 'Retry'],
    'res.nextLevel': ['下一關', '下一关', 'Next level'], 'res.practiceAgain': ['再練一次', '再练一次', 'Practise again'],
    'res.toModes': ['回到模式選擇', '回到模式选择', 'Back to modes'], 'res.toLevels': ['回到選關', '回到选关', 'Level select'], 'res.toDaily': ['回到每日挑戰', '回到每日挑战', 'Daily challenge'],
    'res.home': ['回到首頁', '回到首页', 'Home'], 'res.room': ['回到房間', '回到房间', 'Back to room'],
    'round.nextIn': ['{n} 秒後下一局', '{n} 秒后下一局', 'Next round in {n}s'], 'round.nextNow': ['下一局', '下一局', 'Next round'],

    'chat.title': ['房間聊天', '房间聊天', 'Room chat'], 'chat.ph': ['說點什麼…', '说点什么…', 'Say something…'], 'chat.send': ['送出', '发送', 'Send'],
    'lat.connecting': ['連線中', '连接中', 'Connecting'], 'lat.ariaConnecting': ['正在連線', '正在连接', 'Connecting'], 'lat.aria': ['延遲 {ms} 毫秒', '延迟 {ms} 毫秒', 'Latency {ms} ms'],
    'lat.title': ['和伺服器之間的延遲', '和服务器之间的延迟', 'Latency to the server'],
    'net.disabled': ['這個版本沒有設定線上伺服器，只能玩單機。', '这个版本没有设置在线服务器，只能玩单机。', 'No online server is configured for this build; solo play only.']
  };

  var LOC = { 'zh-Hant': {}, 'zh-Hans': {}, en: {} };
  Object.keys(T).forEach(function (k) { LOC['zh-Hant'][k] = T[k][0]; LOC['zh-Hans'][k] = T[k][1]; LOC.en[k] = T[k][2]; });
  root.SchulteLocales = { table: T, extend: function (more) { Object.keys(more).forEach(function (k) { T[k] = more[k]; root.I18N.add('zh-Hant', obj(k, 0)); root.I18N.add('zh-Hans', obj(k, 1)); root.I18N.add('en', obj(k, 2)); }); } };
  function obj(k, i) { var o = {}; o[k] = T[k][i]; return o; }
  root.I18N.add('zh-Hant', LOC['zh-Hant']);
  root.I18N.add('zh-Hans', LOC['zh-Hans']);
  root.I18N.add('en', LOC.en);

  root.ServerOutageMessages = {
    'zh-Hant': ['線上伺服器暫時休息中', '這個月的免費伺服器額度可能用完了，預計 {date} 月 1 日恢復。單機模式照樣可以玩！', '知道了'],
    'zh-Hans': ['在线服务器暂时休息中', '这个月的免费服务器额度可能用完了，预计 {date} 月 1 日恢复。单机模式照样可以玩！', '知道了'],
    en: ['The online server is resting', 'This month\'s free server quota may be used up. It should be back on {date}. Solo play still works!', 'Got it']
  };
})(typeof self !== 'undefined' ? self : this);
