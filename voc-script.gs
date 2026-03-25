/**
 * ============================
 * 환경설정
 * ============================
 */

const BATCH_SIZE = 20;


/**
 * API KEY 가져오기
 */
function getApiKey(){
  return PropertiesService
    .getScriptProperties()
    .getProperty("ANTHROPIC_API_KEY");
}


/**
 * ============================
 * 메뉴 생성
 * ============================
 */

function onOpen(){

  SpreadsheetApp.getUi()
    .createMenu("VOC 관리")
    .addItem("데이터 전체 업데이트", "runFullUpdate")
    .addSeparator()
    .addItem("1. 고객의견 새로고침", "importVOC")
    .addItem("2. 현재 데이터 재분석", "classifyFeedback")
    .addToUi();

}


/**
 * ============================
 * 전체 실행
 * ============================
 */

function runFullUpdate(){

  importVOC();
  classifyFeedback();

  SpreadsheetApp.getUi().alert("VOC 업데이트 및 분류 완료");

}


/**
 * ============================
 * RAW 데이터 가져오기
 * ============================
 */

function importVOC(){

  const sourceId = "156EONwPv1Ghpewc_chk1r6BNZHdb8vixYdE-lKfbJXk";
  const sourceSheetName = "raw1";
  const targetSheetName = "raw";

  const sourceSS = SpreadsheetApp.openById(sourceId);
  const sourceSheet = sourceSS.getSheetByName(sourceSheetName);
  const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);

  if(!sourceSheet || !targetSheet) return;

  const data = sourceSheet.getDataRange().getValues();

  const columnCount = 12;

  const trimmed = data.map(r => r.slice(0,columnCount));

  targetSheet.getRange(1,1,trimmed.length,columnCount).setValues(trimmed);

}



/**
 * ============================
 * VOC 분류 메인
 * ============================
 */

function classifyFeedback(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rawSheet = ss.getSheetByName("raw");
  const refSheet = ss.getSheetByName("참조");

  if(!rawSheet || !refSheet){
    SpreadsheetApp.getUi().alert("raw 또는 참조 시트 없음");
    return;
  }

  const lastRow = rawSheet.getLastRow();
  if(lastRow < 2) return;

  // 질문 컬럼(11)과 의견+분류 컬럼(12-15) 읽기
  const questionRange = rawSheet.getRange(2,11,lastRow-1,1);
  const questions = questionRange.getValues();

  const range = rawSheet.getRange(2,12,lastRow-1,4);
  const data = range.getValues();

  const refData = refSheet.getDataRange().getValues();

  const caseMap = {};

  for(let i=1;i<refData.length;i++){

    const key = refData[i][0]?.toString().trim();

    if(key){

      caseMap[key] = {

        sentiment: refData[i][1],
        class_or_community: refData[i][2],
        category_1: refData[i][3]

      }

    }

  }

  const aiTargets = [];

  for(let i=0;i<data.length;i++){

    const opinion = data[i][0]?.toString().trim();
    const question = questions[i][0]?.toString().trim() || "";

    if(!opinion) continue;

    if(data[i][1] && data[i][2] && data[i][3]) continue;

    if(caseMap[opinion]){

      data[i][1] = caseMap[opinion].sentiment;
      data[i][2] = caseMap[opinion].class_or_community;
      data[i][3] = caseMap[opinion].category_1;

      continue;

    }

    const rule = ruleClassify(opinion, question);

    if(rule.sentiment !== "기타" && rule.category !== "기타"){

      data[i][1] = rule.sentiment;
      data[i][2] = rule.class_or_community;
      data[i][3] = rule.category;

      continue;

    }

    aiTargets.push({index:i,text:opinion,question:question});

  }

  // AI 분류가 필요한 항목이 있을 때만 API 호출
  if(aiTargets.length > 0){

    try {

      const batches = chunkArray(aiTargets,BATCH_SIZE);

      batches.forEach(batch=>{

        const items = batch.map(v=>({text:v.text,question:v.question}));

        const results = classifyBatchWithClaude(items);

        results.forEach((r,i)=>{

          const rowIndex = batch[i].index;

          data[rowIndex][1] = r.sentiment || "기타";
          data[rowIndex][2] = r.class_or_community || "커뮤니티";
          data[rowIndex][3] = r.category_1 || "기타";

        });

      });

    } catch(e) {

      SpreadsheetApp.getUi().alert(
        "⚠️ API 오류 발생\n\n" +
        e.message + "\n\n" +
        "AI 분류가 필요한 항목: " + aiTargets.length + "개\n" +
        "룰 기반 분류는 완료되었습니다."
      );

      // 에러 발생해도 이미 분류된 데이터는 저장
      range.setValues(data);
      return;

    }

  }

  range.setValues(data);

}



/**
 * ============================
 * 룰 기반 분류
 * ============================
 */

function ruleClassify(opinion, question){

  let sentiment = "기타";

  // 질문에 "불편", "개선" 등이 있으면 답변은 부정으로
  if(question && ['불편','개선','문제','어려움'].some(k=>question.includes(k))){
    sentiment="부정";
  }
  // 질문에 "좋은 점", "만족" 등이 있으면 답변은 긍정으로
  else if(question && ['좋은','만족','칭찬'].some(k=>question.includes(k))){
    sentiment="긍정";
  }
  // 질문 맥락이 없으면 의견 자체로 판단
  else {
    if(['없음','감사','최고','만족'].some(k=>opinion.includes(k)))
      sentiment="긍정";

    // "~하면 좋겠다", "~을 원한다" 등 개선 요청은 부정
    if(['불편','느림','오류','복잡','렉','번거','어렵','좋겠','원한','궁금'].some(k=>opinion.includes(k)))
      sentiment="부정";
  }

  let classComm = "커뮤니티";

  if(['강의','수업','클래스','결제','톡방','쿠폰','환불','완강','포인트','가격','앱']
    .some(k=>opinion.includes(k)))
    classComm = "클래스";

  let category = "기타";

  if(opinion.includes("목실감"))
    category = "목실감";

  else if(['속도','느림','오류','렉'].some(k=>opinion.includes(k)))
    category = "오류/속도";

  else if(['검색','키워드','필터'].some(k=>opinion.includes(k)))
    category = "검색";

  // 탐색 체크를 먼저 (과제 찾기, 과제 보기 등)
  else if(['경로','찾기','복잡','메뉴','카테고리','접근','보이면'].some(k=>opinion.includes(k)))
    category = "탐색";

  // 과제 작성/제출 기능 문제만 글작성
  else if(['작성','제출','글쓰기'].some(k=>opinion.includes(k)) && !opinion.includes('보기') && !opinion.includes('찾'))
    category = "글작성(과제)";

  else if(['조회','보기','정보'].some(k=>opinion.includes(k)))
    category = "글조회";

  return {

    sentiment: sentiment,
    class_or_community: classComm,
    category: category

  };

}



/**
 * ============================
 * Claude Batch 호출
 * ============================
 */

function classifyBatchWithClaude(items){

  const apiKey = getApiKey();

  if(!apiKey){
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }

  const prompt = `

당신은 VOC 분류 전문가입니다. 다음 기준을 정확히 따르세요.

## 중요 원칙
1. **질문 맥락 고려**: 질문이 "불편한 점"을 묻는다면 답변은 자동으로 **부정**
2. "~하면 좋겠다", "~이 없다", "~을 원한다" = 현재 불만 = **부정**
3. "과제"라는 단어가 있어도, 과제를 **찾거나 보는** 것이 어렵다면 = **탐색**
4. "과제를 작성/제출하는 기능"이 불편할 때만 = **글작성(과제)**

## sentiment (감정)
- **긍정**: 만족, 감사, 칭찬 ("좋아요", "감사합니다", "만족스러워요")
- **부정**: 불편함, 개선 요청, 문제 제기
  * 질문이 "불편", "개선", "문제" 등을 묻는다면 → **부정**
  * "~하면 좋겠다" ← 현재 없어서 불만 = 부정
  * "~이 어렵다", "~을 모르겠다" = 부정
- **기타**: 단순 질문이나 중립적 의견

## class_or_community
- **클래스**: 강의, 수업, 과제, 결제, 쿠폰 등 교육 콘텐츠
- **커뮤니티**: 게시글, 댓글, 팔로우 등 커뮤니티 기능

## category_1 (카테고리)
- **오류/속도**: 버그, 오류, 느림, 렉, 안됨
- **검색**: 검색 기능, 키워드 검색, 필터
- **탐색**: 메뉴/과제/자료를 찾기 어려움, 접근 방법 모름, UI 복잡함
- **목실감**: 목실감 기능 관련
- **글작성(과제)**: 글 쓰기나 과제 제출 기능 자체의 문제
- **알림**: 알림, 푸시
- **글조회**: 게시글 내용 보기, 읽기
- **좋아요/댓글/팔로우**: 소셜 인터랙션 기능
- **기타**: 위 항목에 해당 없음

## 예시 (정확히 따르세요)
Q: "불편한 점이 있나요?" A: "검색 필터링 기능" → {sentiment:"부정", class_or_community:"커뮤니티", category_1:"검색"}
"과제보기 메뉴가 보이면 좋겠다" → {sentiment:"부정", class_or_community:"클래스", category_1:"탐색"}
"과제를 찾을 수 없다" → {sentiment:"부정", class_or_community:"클래스", category_1:"탐색"}
"앱이 너무 좋아요" → {sentiment:"긍정", class_or_community:"기타", category_1:"기타"}

## 분류할 VOC

${items.map((v,i)=>{
  if(v.question){
    return `${i+1}. [질문: ${v.question}] 답변: ${v.text}`;
  }
  return `${i+1}. ${v.text}`;
}).join("\n")}

**JSON 배열로만 반환 (설명 없이)**:

[
{
"sentiment":"긍정 | 부정 | 기타",
"class_or_community":"클래스 | 커뮤니티",
"category_1":"오류/속도 | 검색 | 탐색 | 목실감 | 글작성(과제) | 알림 | 글조회 | 좋아요/댓글/팔로우 | 기타"
}
]

`;

  const payload = {

    model:"claude-haiku-4-5-20251001",
    max_tokens:500,
    temperature:0,

    messages:[
      {
        role:"user",
        content:prompt
      }
    ]

  };

  try {

    const response = UrlFetchApp.fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method:"post",
        headers:{
          "x-api-key":apiKey,
          "anthropic-version":"2023-06-01",
          "content-type":"application/json"
        },
        payload:JSON.stringify(payload),
        muteHttpExceptions: true  // 전체 에러 메시지 확인
      }
    );

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    // API 오류 체크
    if(responseCode !== 200){

      const errorData = JSON.parse(responseText);

      if(responseCode === 400 && errorData.error?.message?.includes("credit balance")){
        throw new Error(
          "🚨 Anthropic API 크레딧 부족\n\n" +
          "https://console.anthropic.com/settings/plans 에서\n" +
          "크레딧을 충전하거나 플랜을 업그레이드하세요."
        );
      }

      throw new Error(
        "API 오류 (코드 " + responseCode + ")\n" +
        errorData.error?.message || responseText
      );
    }

    const result = JSON.parse(responseText);

    const textOutput = result.content[0].text;

    return JSON.parse(textOutput.replace(/```json|```/g,"").trim());

  } catch(e) {

    // 에러를 상위로 전달
    throw e;

  }

}



/**
 * ============================
 * 배열 분할
 * ============================
 */

function chunkArray(arr,size){

  const result=[];

  for(let i=0;i<arr.length;i+=size){
    result.push(arr.slice(i,i+size));
  }

  return result;

}
