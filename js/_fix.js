const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');
const lines = code.split('\n');

// Find _getPeriodInfo DEFINITION
const startIdx = lines.findIndex(l => l.trim().startsWith('_getPeriodInfo('));
console.log('_getPeriodInfo at line', startIdx + 1);

// Find HomeView closing }; 
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '};' && i > startIdx + 10) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('HealthView') || lines[j].includes('=====')) {
        endIdx = i;
        break;
      }
    }
    if (endIdx > startIdx) break;
  }
}
console.log('HomeView closes at line', endIdx + 1);

// New clean _getPeriodInfo using only basic syntax
const newMethod = [
  '  _getPeriodInfo(periods, today) {',
  '    if (periods.length === 0) {',
  "      return { cyclePercent:0, ringText:'\u2014', ringLabel:'\u6682\u65e0\u8bb0\u5f55', title:'\u7ecf\u671f\u8bb0\u5f55', desc:'\u70b9\u51fb\u5065\u5eb7\u9875\u9762\u8bb0\u5f55\u7ecf\u671f', dayNum:'--', dayLabel:'\u5468\u671f\u65e5', cycleLen:'--', periodLen:'--', avgCycle:0, avgPeriod:0, quickNum:'--', quickUnit:'', quickLabel:'\u7ecf\u671f', cardTitle:'\u6682\u65e0\u7ecf\u671f\u8bb0\u5f55', cardDesc:'\u53bb\u5065\u5eb7\u9875\u9762\u8bb0\u5f55\u9996\u6b21\u7ecf\u671f', cardNum:'\u2014', cardUnit:'', hourglassTitle:'\u6682\u65e0\u8bb0\u5f55', hourglassDesc:'\u70b9\u51fb\u5065\u5eb7\u9875\u9762\u8bb0\u5f55\u7ecf\u671f', daysUntilNext:undefined, nextDateStr:'--' };",
  '    }',
  '    var sorted = periods.slice().sort(function(a,b){return b.startDate.localeCompare(a.startDate);});',
  '    var latest = sorted[0];',
  '    var todayDate = parseDate(today);',
  '    var latestStart = parseDate(latest.startDate);',
  '    var dayOfCycle = Math.floor((todayDate-latestStart)/86400000)+1;',
  '    var avgCycle=28, avgPeriod=5;',
  '    if (sorted.length>=2) { var c=[]; for(var i=1;i<sorted.length;i++){var d1=parseDate(sorted[i].startDate),d2=parseDate(sorted[i-1].startDate);c.push(Math.round((d1-d2)/86400000));} avgCycle=Math.round(c.reduce(function(a,b){return a+b;},0)/c.length); }',
  '    var pds=sorted.filter(function(p){return p.endDate;}).map(function(p){return Math.floor((parseDate(p.endDate)-parseDate(p.startDate))/86400000)+1;});',
  '    if(pds.length>0){avgPeriod=Math.round(pds.reduce(function(a,b){return a+b;},0)/pds.length);}',
  '    var latestEnd=latest.endDate?parseDate(latest.endDate):null;',
  '    var inPeriod=!latestEnd||todayDate<=latestEnd;',
  '    var npd=new Date(latestStart.getTime()+avgCycle*86400000);',
  '    var dun=Math.ceil((npd-todayDate)/86400000);',
  '    var nmon=npd.getMonth()+1, nday=npd.getDate();',
  "    if(inPeriod&&dayOfCycle<=avgPeriod){ return {cyclePercent:Math.min(dayOfCycle/avgCycle*100,100),ringText:'D'+dayOfCycle,ringLabel:'\u7ecf\u671f\u4e2d',title:'\u7ecf\u671f\u4e2d',desc:'\u7b2c'+dayOfCycle+'\u5929',dayNum:dayOfCycle,dayLabel:'\u7b2c\u51e0\u5929',cycleLen:avgCycle,periodLen:avgPeriod,avgCycle:avgCycle,avgPeriod:avgPeriod,quickNum:dayOfCycle,quickUnit:'\u5929',quickLabel:'\u7ecf\u671f\u4e2d',cardTitle:'\u7ecf\u671f\u8fdb\u884c\u4e2d',cardNum:dayOfCycle,cardUnit:'\u5929',hourglassTitle:'\u7ecf\u671f\u4e2d',daysUntilNext:undefined,nextDateStr:nmon+'\u6708'+nday+'\u65e5'}; }",
  "    return {cyclePercent:Math.min(dayOfCycle/avgCycle*100,100),ringText:dun>0?String(dun):'?',ringLabel:'\u5929\u540e\u9884\u8ba1',title:dun>0?'\u9884\u8ba1\u7ecf\u671f':'\u53ef\u80fd\u5df2\u63a8\u8fdf',desc:dun>0?'\u7ea6'+dun+'\u5929\u540e':'\u5efa\u8bae\u8bb0\u5f55',dayNum:dayOfCycle,dayLabel:'\u5468\u671f\u65e5',cycleLen:avgCycle,periodLen:avgPeriod,avgCycle:avgCycle,avgPeriod:avgPeriod,quickNum:dun>0?dun:'!',quickUnit:dun>0?'\u5929':'',quickLabel:'\u8ddd\u4e0b\u6b21',cardTitle:dun>0?'\u9884\u8ba1\u4e0b\u6b21':'\u7ecf\u671f\u53ef\u80fd\u63a8\u8fdf',cardNum:dun>0?dun:'!',cardUnit:dun>0?'\u5929\u540e':'',hourglassTitle:dun>0?'\u8ddd\u4e0b\u6b21\u7ecf\u671f':'\u6ce8\u610f\u89c2\u5bdf',daysUntilNext:dun>0?dun:-1,nextDateStr:nmon+'\u6708'+nday+'\u65e5'};",
  '  }'
];

const newCode = [...lines.slice(0, startIdx), ...newMethod, ...lines.slice(endIdx + 1)].join('\n');
fs.writeFileSync('js/app.js', newCode);
console.log('Done. Lines:', newCode.split('\n').length);
