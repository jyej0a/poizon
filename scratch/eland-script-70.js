
// PV가 발생하는 페이지 (APP) active_slide 변수 확인
if (platform == '40') {
header_title_ga = document.title;
if ("/s/srch".split('/') && ("/s/srch".split('/').length > 2)) {
active_slide = "/s/srch".split('/')[2];
} else {
active_slide = 'main';
}
dataLayer.push({
'event': 'virtual_pageview',
'page_location': '//' + window.location.hostname + window.location.pathname,
'page_title': header_title_ga + ' - ' + active_slide
});
}
var chnl_code = '';
if (platform == '30') {
chnl_code = 'Mobile Web';
} else if (platform == '40') {
chnl_code = 'App';
} else {
chnl_code = 'PC Web';
}
if (s_tr_login_yn == "Y") { // 로그인
dataLayer.push({
age: window.UIPage.userAge,
gender: window.UIPage.userGender,
custId: window.UIPage.custId,
grade: window.UIPage.userGrade,
register_date: window.UIPage.userJoinDt,
login: "○",
chnl_cd: chnl_code,
staff_yn: window.UIPage.userStaffYn
});
} else { // 비로그인
dataLayer.push({ // 비로그인
age: "",
gender: "",
custId: "",
grade: "",
register_date: "",
login: "X",
chnl_cd: chnl_code,
staff_yn: "",
first_login_yn: "X"
});
}
// HTML decoder
function decodeHtmlEntities(encodedString) {
const textarea = document.createElement("textarea");
textarea.innerHTML = encodedString;
return textarea.value;
}
function decodeNestedObject(obj) {
for (const key in obj) {
if (typeof obj[key] === "string") {
obj[key] = decodeHtmlEntities(obj[key]);
} else if (typeof obj[key] === "object" && obj[key] !== null) {
decodeNestedObject(obj[key]);
}
}
return obj;
}
// GA 출석체크 완료 후
function loginCheckEvent() {
ga4Events.AttendanceCheck();
};
// Braze 출석체크 완료 후
function attendanceCheckCompleted(couponInfo) {
if ((window.UIPage.dispMallNo === '0000113') || (window.UIPage.dispMallNo === '0000125')) { // 키디키디 & 업투맥스
if (couponInfo && typeof couponInfo === 'object') {
try {
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.attendanceCheckCompleted(couponInfo.eventName, couponInfo.eventNo, couponInfo.eventStart, couponInfo.eventEnd);
}, 10);
} catch {
console.log('Flutter ERROR');
}
} else {
brazeEvents.AttendanceCheckCompleted(couponInfo);
}
} catch (err) {
console.log("+++BRAZE+++", 'Braze KD_출석체크 Completed ERR ' + err);
}
}
}
};
// 온사이트 팝업 노출
function onsitePopupView(popupInfo) {
ga4Events.OnsitePopupView(popupInfo);
};
// 온사이트 팝업 클릭
function onsitePopupClick(popupInfo) {
ga4Events.OnsitePopupClick(popupInfo);
};
// 온사이트 혜택 클릭
function onsitePhraseClick(benefitInfo) {
ga4Events.OnsitePhraseClick(benefitInfo);
};
// 이벤트 응모 완료 후
function eventCompleted(couponInfo) {
if (window.UIPage.dispMallNo === '0000113') { // 키디키디
if (couponInfo && typeof couponInfo === 'object') {
try {
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.eventCompleted(couponInfo.eventName, couponInfo.eventNo, couponInfo.eventStart, couponInfo.eventEnd);
}, 10);
} catch {
console.log('Flutter EventCompleted ERROR');
}
} else {
brazeEvents.EventAttendCompleted(couponInfo);
}
} catch (err) {
console.log("+++BRAZE+++", 'Braze KD_이벤트 참여 Completed ERR ' + err);
}
}
}
};
// 이벤트 응모 당첨 후
function eventCouponCheck(couponInfo) {
ga4Events.EventCouponCheck(couponInfo);
};
// KIDIKIDI 아이등록 완료 후
function kidsInfoCompleted(kidsInfo) {
var deferred = $.Deferred();
var done = function () {
deferred.resolve();
};
if ((window.UIPage.dispMallNo === '0000113') && (kidsInfo && typeof kidsInfo === 'object')) {
try {
const actionType = 'INSERT';
console.log(actionType);
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.applyKidInfoChanges(kidsInfo.kidsNo, kidsInfo.kidsName, kidsInfo.kidsGender, kidsInfo.kidsBirth, actionType, kidsInfo.regSourceType);
done();
}, 10);
} catch {
console.log('Flutter applyKidInfoChanges ERROR');
done();
}
} else {
brazeEvents.ApplyKidInfoChanges(kidsInfo, actionType);
done();
}
} catch (err) {
console.log("+++BRAZE+++", 'Braze KD_아이등록 Completed ERR ' + err);
done();
}
}
return deferred.promise();
};
// KIDIKIDI 아이등록 수정
function kidsInfoUpdated(kidsInfo) {
var deferred = $.Deferred();
var done = function () {
deferred.resolve();
};
if ((window.UIPage.dispMallNo === '0000113') && (kidsInfo && typeof kidsInfo === 'object')) {
try {
const actionType = 'UPDATE';
console.log(actionType);
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.applyKidInfoChanges(kidsInfo.kidsNo, kidsInfo.kidsName, kidsInfo.kidsGender, kidsInfo.kidsBirth, actionType);
done();
}, 10);
} catch {
console.log('Flutter applyKidInfoChanges ERROR');
done();
}
} else {
brazeEvents.ApplyKidInfoChanges(kidsInfo, actionType);
done();
}
} catch (err) {
console.log("+++BRAZE+++", 'Braze KD_아이등록 Updated ERR ' + err);
done();
}
}
return deferred.promise();
}
// KIDIKIDI 아이등록 삭제
function kidsInfoDeleted(kidsInfo) {
var deferred = $.Deferred();
var done = function () {
deferred.resolve();
};
if ((window.UIPage.dispMallNo === '0000113') && (kidsInfo && typeof kidsInfo === 'object')) {
try {
const actionType = 'DELETE';
console.log(actionType);
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.applyKidInfoChanges(kidsInfo.kidsNo, kidsInfo.kidsName, kidsInfo.kidsGender, kidsInfo.kidsBirth, actionType);
done();
}, 10);
} catch {
console.log('Flutter applyKidInfoChanges ERROR');
done();
}
} else {
brazeEvents.ApplyKidInfoChanges(kidsInfo, actionType);
done();
}
} catch (err) {
console.log("+++BRAZE+++", 'Braze KD_아이등록 Deleted ERR ' + err);
done();
}
}
return deferred.promise();
}
// 상품상세페이지 이동 시 (상품상세 클릭 이벤트 발생했을때)
function itemClickTracking(itemClkTrack) {
// try {
// tracking_ctg_path_list = [];
// disp_l_category = itemClkTrack.disp_l_category.replaceAll("/", ",")
// tracking_ctg_path_list.push(disp_l_category)
// disp_m_category = itemClkTrack.disp_m_category.replaceAll("/", ",")
// tracking_ctg_path_list.push(disp_m_category)
// disp_s_category = itemClkTrack.disp_s_category.replaceAll("/", ",")
// tracking_ctg_path_list.push(disp_s_category)
// } catch { //ignore
// }
corner_info = window.location.search;
if (corner_info.indexOf('preCornerNo=') > -1) {
corner_info = corner_info.split('preCornerNo=')[1]
if (corner_info.indexOf('&') > -1) {
corner_info = corner_info.substring(0, corner_info.indexOf('&'))
}
} else {
corner_info = ''
}
};
// 상품상세 레이어 조회 후
function itemDetailLayer(itemLayer) {
if (itemLayer && typeof itemLayer === 'object') {
try {
tracking_ctg_path_list = [];
disp_l_category = itemLayer.disp_l_category.replaceAll("/", ",")
tracking_ctg_path_list.push(disp_l_category)
disp_m_category = itemLayer.disp_m_category.replaceAll("/", ",")
tracking_ctg_path_list.push(disp_m_category)
disp_s_category = itemLayer.disp_s_category.replaceAll("/", ",")
tracking_ctg_path_list.push(disp_s_category)
} catch { //ignore
}
// disp_mall 추가 변경 사항 있을 때 관리 필요
disp_mall_map = {
"0000013" : "모던하우스",
"0000014" : "이랜드몰",
"0000033" : "에블린",
"0000034" : "로이드",
"0000035" : "로엠",
"0000036" : "클루",
"0000037" : "스파오",
"0000038" : "뉴발란스",
"0000039" : "폴더",
"0000040" : "킨더리그",
"0000041" : "OST",
"0000042" : "후아유",
"0000043" : "미쏘",
"0000044" : "바후스",
"0000045" : "킴스클럽",
"0000053" : "슈펜",
"0000063" : "뉴발란스키즈",
"0000073" : "럭셔리갤러리",
"0000113" : "KIDIKIDI",
"0000123" : "애니바디",
"0000124" : "클라비스",
"0000125" : "업투맥스"
};
header_title = '';
if (dispMallNo != '') {
header_title = disp_mall_map[dispMallNo];
}
appierRtProduct = [{"productID": itemLayer.item_no, "price": itemLayer.sale_price}];
function appierGoodsViewLayerScript() {
window.appier_q = window.appier_q || [];
if (s_tr_login_yn == "Y") {
window.appier_q.push(
{"t": "register", "content": {"id": "2bb7", "site": "elandmall.co.kr"}},
{"t": "type_product", "itemList": appierRtProduct},
{"t": "type_login", "idtype": "email_sha256", "content": s_email_sha256}
);
} else {
window.appier_q.push(
{"t": "register", "content": {"id": "2bb7", "site": "elandmall.co.kr"}},
{"t": "type_product", "itemList": appierRtProduct}
);
}
}
// appier 상품상세 레이어 조회 후
appierScriptProc({callback: appierGoodsViewLayerScript});
}
};
// 찜하기_상품
function wishClick(wish_detail) {
const dealItemYn = (wish_detail.item_tcode === '80' ? "Y" : "N");
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.addToWishlist(String(wish_detail.item_no), String(wish_detail.sell_price), String(wish_detail.qty), String(wish_detail.itemName), String(wish_detail.imagePath), String(wish_detail.brandName), String(wish_detail.sale_price), String(dealItemYn));
}, 10);
// Flutter.addToWishlist(String(wish_detail.item_no), String(wish_detail.sale_price), String(wish_detail.qty));
} catch {
console.log('tracking');
}
} else {
// Braze
try {
brazeEvents.ItemWishlist(wish_detail);
} catch (err) {
console.log('Braze 찜하기 ERR ' + err);
}
// Braze
}
// GA4
ga4Events.AddToWishlist(wish_detail);
try {
airbridgeEvents.ItemWishlist(wish_detail);
kakaoMoment.ItemWishlist(wish_detail);
naverPremiumLogEvents.ItemWishlist(wish_detail);
if (dispMallNo === "0000113") {
rtbhouseEvents.ItemWishlist(wish_detail.item_no);
}
} catch (err) {
console.log('wishClick Event ERR : '+ err);
}
}
// 찜하기_브랜드
function brandWishClick(brandName) {
try {
airbridgeEvents.BrandWishlist(brandName);
} catch (err) {
console.log('brandWishClick Event ERR : '+ err);
}
}
// 공유하기
function shareClick(share_detail) {
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.share();
}, 10);
// Flutter.share();
} catch {
console.log('tracking')
}
}
try {
airbridgeEvents.Share();
} catch (err) {
console.log('Share Event ERR : ' + err)
}
}
// 쿠폰 발급 완료
function DownloadCoupon(coupon_no, coupon_name) {
try {
airbridgeEvents.DownloadCoupon(coupon_no, coupon_name);
} catch (err) {
console.log('DownloadCoupon Event ERR : '+err)
}
}
// 회원가입
function signUp_branch(user_id, cust_id, domain, signupParam) {
if (platform == '40') {
Flutter.logEvent("signup_complete",JSON.stringify({"mall_domain":domain}));
Flutter.signup(signupParam);
}
try {
ga4Events.SignupComplete(domain); // GA4
airbridgeEvents.SignUp();
} catch (err) {
console.log("signup_complete Event ERR : "+err)
}
}
// 로그인
function logIn_branch(user_id, cust_id, deliveryCnt, firstLogin, age, gender) {
if (platform != '40') {
brazeEvents.SignIn();
} else {
Flutter.login(user_id, cust_id, deliveryCnt, firstLogin, age, gender);
}
try {
airbridgeEvents.SignIn();
} catch (err) {
console.log('Login Event ERR ' + err);
}
}
// 리뷰 작성 및 수정
function reviewEdit (review_detail) {
if (dispMallNo == "0000014") {
if (platform == '40') {
try {
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.reviewWrite(String(review_detail.itemNo), String(review_detail.itemName));
}, 10);
// Flutter.reviewWrite(String(review_detail.itemNo), String(review_detail.itemName));
} catch {
console.log('tracking')
}
}
}
}
// 메뉴 클릭시 (전체 카테고리 제외한 GNB 영역)
function menuClick(header_title_ga, active_slide) {
if (header_title_ga && active_slide) {
dataLayer.push({
'event': 'virtual_pageview',
'page_location': '//' + window.location.hostname + window.location.pathname,
'page_title': header_title_ga + ' - ' + active_slide
});
}
};
// 장바구니 버튼 클릭시
function addToCart(ga_products) {
if (ga_products && typeof ga_products === 'object') {
total_cart_qty = 0
total_cart_price = 0
cart_item_no = []
cart_item_names = []
brand_names = []
cart_qty = []
try {
tracking_ctg_path_list = [];
tracking_ctg_no_path_list = [];
disp_l_category = ga_products.disp_l_category;
tracking_ctg_path_list.push(disp_l_category.replaceAll('/', ','));
tracking_ctg_no_path_list.push(ga_products.disp_l_category_no);
disp_m_category = ga_products.disp_m_category;
tracking_ctg_path_list.push(disp_m_category.replaceAll('/', ','));
tracking_ctg_no_path_list.push(ga_products.disp_m_category_no);
disp_s_category = ga_products.disp_s_category;
tracking_ctg_path_list.push(disp_s_category.replaceAll('/', ','));
tracking_ctg_no_path_list.push(ga_products.disp_s_category_no);
} catch { // ignore
}
for (itemd of ga_products.item_dtl) {
total_cart_price += parseInt(itemd.sale_price)
total_cart_qty += parseInt(itemd.ord_qty)
cart_item_no.push(itemd.item_no)
cart_item_names.push(itemd.item_name)
brand_names.push(itemd.brand_name)
cart_qty.push(itemd.ord_qty)
}
// criteo 장바구니 버튼 클릭
add_cart_items = [];
for (var product of ga_products.item_dtl) {
add_cart_items.push({
"id": product.item_no,
"price": product.sale_price,
"quantity": product.ord_qty
});
}
window.criteo_q = window.criteo_q || [];
window.criteo_q.push(
{event: "setAccount", account: s_account},
{event: "setHashedEmail", email: s_email_sha256},
{event: "setSiteType", type: deviceType},
{event: "addToCart", item: add_cart_items}
);
var item_data_app = []; // Flutter 함수로 보내는 데이터
// Flutter 데이터 준비
if (ga_products.item_dtl && typeof ga_products.item_dtl === 'object') {
for (var product of ga_products.item_dtl) {
if (product.uitem_name != "옵션없음") {
product.uitem_name = product.uitem_name.replaceAll(",", "/");
}
goods_push_data = {
name: product.item_name,
id: product.item_no,
price: product.sale_price,
brand: product.brand_name,
variant: product.uitem_name,
quantity: product.ord_qty,
category: tracking_ctg_path_list.join('/'),
coupon: (ga_products.coupon_name) ? (ga_products.coupon_name) : '',
dimension10: (ga_products.bundle_item_no) ? (ga_products.bundle_item_no) : ''
};
goods_push_data.salePrice = product.sale_price;
goods_push_data.price = product.sellprice;
item_data_app.push(goods_push_data);
}
}
// GA4
ga4Events.AddToCart(ga_products);
// appier 장바구니 버튼 클릭 시
appierRtAddToCart = [];
appierRtAddToCart = [{
"productID": ga_products.group_item_no,
"unit": total_cart_qty,
"price": ga_products.group_sale_price
}];
window.appier_q = window.appier_q || [];
window.appier_q.push(
{"t": "register", "content": {"id": "2bb7", "site": "elandmall.co.kr"}},
{"t": "type_addcart", "itemList": appierRtAddToCart}
);
if (platform == '40') {
try {
chlNo = ""
if (dispMallNo == "0000014") {
chlNo = "DPA"
}
brand_names = [...new Set(brand_names)];
img_url = (window.UIPage.server.isProduct) ? ga_products.img_path : '';
item_data = { item_data : item_data_app };
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue)
Flutter.addToCart(brand_names.join(), cart_item_no.join(), cart_item_names.join(), tracking_ctg_path_list.join('/'), String(total_cart_price), String(total_cart_price), String(total_cart_qty), String(img_url), String(chlNo), item_data, String(ga_products.disp_l_category), String(ga_products.disp_m_category), String(ga_products.disp_s_category));
}, 10);
// Flutter.addToCart(brand_names.join(), cart_item_no.join(), cart_item_names.join(), tracking_ctg_path_list.join('/'), String(total_cart_price), String(total_cart_price), String(total_cart_qty), String(img_url), String(chlNo));
} catch {
console.log('tracking');
}
} else {
// Braze
try {
brazeEvents.AddToCart(ga_products);
} catch (err) {
console.log('Braze 상품 Added to Cart ERR ' + err);
}
// Braze
}
try {
airbridgeEvents.AddToCart(ga_products);
kakaoMoment.AddToCart(ga_products.item_dtl);
naverPremiumLogEvents.AddToCart(ga_products);
if (dispMallNo === "0000113") {
rtbhouseEvents.AddToCart(cart_item_no);
}
} catch (err) {
console.log('AddToCart Event ERR : ' + err);
}
}
};
/* 장바구니 삭제 이벤트 및 주문서 페이지 GA 트래킹은 ga_order.ftl 에서 관리 (24-01-31) */
/* function removeFromCart(real_ga_products) {
if (real_ga_products && typeof real_ga_products === 'object') {
// GA360
dataLayer.push({
event: "removeFromCart",
ecommerce: {
remove: {
products: (function () {
goods = [];
for (var product of real_ga_products) {
//카테고리는 별도조회..
let tracking_ctg_path_list = [];
try {
eAjax.get({
url: "/api/od/search/category",
method: "GET",
dataType: "json",
data: {
itemNo: product.itemNo
},
async: false,
}).done(function (response) {
if (response.data != null) {
product.disp_l_category = optionerChaining(response.data.dispLCategory, '');
product.disp_m_category = optionerChaining(response.data.dispMCategory, '');
product.disp_s_category = optionerChaining(response.data.dispSCategory, '');
tracking_ctg_path_list.push(product.disp_l_category.replaceAll('/', ','))
tracking_ctg_path_list.push(product.disp_m_category.replaceAll('/', ','))
tracking_ctg_path_list.push(product.disp_s_category.replaceAll('/', ','))
}
}).fail(function (e) {
console.log("error::removeFromCart::상품카테고리조회 실패");
})
} catch (e) {
//ignore
}
goods.push({
name: product.itemName,
id: product.itemNo,
price: product.sellPrice,
brand: product.brandName,
variant: product.uitemName,
quantity: product.ordQty,
category: tracking_ctg_path_list.join('/'),
coupon: product.promotionNames,
// dcamt: product.discountAmountPerUnit,
// dcprice: product.promotionPrice,
dimension10: product.setItems,
});
}
return goods;
})()
}
}
});
// GA4
ga4_total_amount = 0;
try {
for (var product of real_ga_products) {
ga4_total_amount += product.sellPrice;
}
} catch (err) {
console.log("ga4_total_amount Error" + err);
}
ecommerceLogEvent("remove_from_cart", {
value: ga4_total_amount, // 주문결제총액
currency: "KRW",
items: (function () {
goods_ga4 = [];
for (var product of real_ga_products) {
goods_ga4.push({
item_name: product.itemName,
item_id: product.itemNo,
currency: "KRW",
price: product.promotionPrice, // 최대할인가
item_brand: product.brandName,
variant: product.uitemName,
quantity: product.ordQty,
// coupon: product.promotionNames,
// dcamt: product.discountAmountPerUnit,
// dcprice: product.promotionPrice,
// dimension10: product.setItems,
item_category: product.disp_l_category,
item_category2: product.disp_m_category,
item_category3: product.disp_s_category,
});
}
return goods_ga4;
})()
});
}
};*/
// 주문 취소 신청 후
function orderCancel(ord_no, ga_refund_products) {
if (ord_no && ga_refund_products) {
ga4_data = [];
for (var product of ga_refund_products.items) {
ga4_data.push({
item_id: product.item_no,
item_name: product.item_name,
currency: 'KRW',
quantity: product.recept_qty,
item_brand: product.brand_name, // Ex : 로엠, 애니바디, 스파오..
item_category: product.item_category1, // Ex : 메인, 로그인..
item_category2: product.item_category2, // Ex : 신생아 의류,아우터..
item_category3: product.item_category3, // Ex : 세트기획,상하세트..
price: product.price, // Ex : 39900, ...
size: '',
color: ''
});
}
// GA4
ga4Events.Refund(ord_no, ga_refund_products, ga4_data);
try {
airbridgeEvents.OrderCancle(ord_no, ga_refund_products);
} catch (err) {
console.log('OrderCancle Event ERR : ' + err);
}
}
};
// 반품 처리 시
function orderRefund(ord_no, ga_products) {
if (ord_no && ga_products) {
console.log(ga_products);
ga4_data = [];
for (var product of ga_products.items) {
ga4_data.push({
item_id: product.item_no,
item_name: product.item_name,
currency: 'KRW',
quantity: product.recept_qty,
item_brand: product.brand_name, // Ex : 로엠, 애니바디, 스파오..
item_category: product.item_category1, // Ex : 메인, 로그인..
item_category2: product.item_category2, // Ex : 신생아 의류,아우터..
item_category3: product.item_category3, // Ex : 세트기획,상하세트..
price: product.price, // Ex : 39900, ...
size: '',
color: ''
});
}
// GA4
ga4Events.Refund(ord_no, ga_products, ga4_data);
try {
airbridgeEvents.OrderCancle(ord_no, ga_products);
} catch (err) {
console.log('OrderCancle Event ERR : ' + err);
}
}
};
// 주문서 페이지에서 구매하기 버튼 클릭 시
function orderBtnclick(order) {
let payInfo = order.payinfo;
let items = order.items;
if (payInfo && items && typeof payInfo === 'object' && typeof items === 'object') {
var goods = [];
var goods_ga4 = [];
for (var product of items) {
if (product.uitem_name != "옵션없음") {
product.uitem_name = product.uitem_name.replaceAll(",", "/");
}
//카테고리는 별도조회..
let tracking_ctg_path_list = [];
try {
eAjax.get({
url: "/api/od/search/category",
method: "GET",
dataType: "json",
data: {
itemNo: product.itemNo
},
async: false,
}).done(function (response) {
if (response.data != null) {
product.disp_l_category = optionerChaining(response.data.dispLCategory, '');
product.disp_m_category = optionerChaining(response.data.dispMCategory, '');
product.disp_s_category = optionerChaining(response.data.dispSCategory, '');
tracking_ctg_path_list.push(product.disp_l_category.replaceAll('/', ','))
tracking_ctg_path_list.push(product.disp_m_category.replaceAll('/', ','))
tracking_ctg_path_list.push(product.disp_s_category.replaceAll('/', ','))
}
}).fail(function (e) {
console.log("error::removeFromCart::상품카테고리조회 실패");
})
} catch (e) {
//ignore
}
goods.push({
name: product.item_name,
id: product.item_no.toString(),
price: product.sale_price,
// dcamt: 0,
// dcprice: 0,
brand: product.brand_name,
variant: product.uitem_name,
quantity: product.quantity,
category: tracking_ctg_path_list.join('/'),
coupon: (product.coupon) ? (product.coupon) : '',
dimension10: product.dimension10
});
var sizeColor = ga4Events._extractSizeColor(product.selectedOptionInfos);
goods_ga4.push({
item_name: product.item_name,
item_id: product.item_no.toString(),
currency:"KRW",
price: product.unit_dc_price,
item_brand: product.brand_name,
// variant: product.uitem_name,
quantity: product.quantity,
item_category:product.disp_l_category,
item_category2:product.disp_m_category,
item_category3:product.disp_s_category,
uitem_name: (product.uitem_name) ? product.uitem_name : '옵션없음',
size: sizeColor.size,
color: sizeColor.color,
});
}
if ((typeof goods != 'undefined') && (goods.length >= 10)) {
for (let i = 0; i < Math.ceil(goods.length / 10); i++) {
// GA4
ga4Events.BeginCheckout(payInfo, goods_ga4.slice((i*10), (i*10)+10));
}
} else {
// GA4
ga4Events.BeginCheckout(payInfo, goods_ga4);
}
}
try {
airbridgeEvents.InitiateCheckout(order);
} catch (err) {
console.log('initiateCheckout Event ERR '+err);
}
};
// 주문완료 페이지 첫구매 이벤트
function firstOrderLastOrder() {
if (platform == '40') {
try {
item_data = {item_data: window.UIPage.order};
Flutter.initPurchase(String(window.UIPage.order.coupon_names), "KRW", String(ordPayParse), String(tax), String(window.UIPage.order.total_del_amount), String(s_ord_no), String(chlNo), item_data, window.UIPage.loginId);
} catch (err) {
console.log("Flutter.initPurchase ERR : " + err);
}
}
try {
airbridgeEvents.FirstOrder();
} catch (err) {
console.log("FirstOrder Event ERR : " + err);
}
};
// 주문완료 페이지
function orderCompPage() {
if (window && window.UIPage && window.UIPage.order && typeof window.UIPage.order === 'object') {
window.UIPage.order = decodeNestedObject(window.UIPage.order);
<!-- 구매전환 트래커 -->
s_ord_no = window.UIPage.order.ord_no;
mbr_no = "";
chnl_no = window.UIPage.order.mktg_channel_code;
itemArray = [];
for (var item_d of window.UIPage.order.order_item_list) {
//#18360 상품별 더블쿠폰이 있는경우 세팅(더블쿠폰만 요청함.)
if (item_d.item_coupons && item_d.item_coupons.length > 0) {
let itemCoupons = item_d.item_coupons;
if (itemCoupons.length > 0) {
item_d.item_coupon = itemCoupons[0]; //더블쿠폰은 상품당 최대1개이므로 첫번째 인자만 세팅한다
}
}
itemArray.push({
id: item_d.item_no,
price: item_d.sale_price,
quantity: item_d.ord_qty
});
}
itemlist_tg = [];
for (var item_d of window.UIPage.order.order_item_list) {
itemlist_tg.push({
i: item_d.item_no,
t: item_d.item_name,
p: (parseInt(item_d.sale_price) * parseInt(item_d.ord_qty)),
q: item_d.ord_qty
});
}
ordPay = window.UIPage.order.total_amount;
chnlNo = 0;
if (chnl_no == "CT") {
chnlNo = 1;
}
// criteo 구매완료
if (itemArray && (itemArray.length > 0)) {
window.criteo_q = window.criteo_q || [];
window.criteo_q.push(
{event: "setAccount", account: s_account},
{event: "setHashedEmail", email: s_email_sha256},
{event: "setSiteType", type: deviceType},
{
event: "trackTransaction", id: s_ord_no,
deduplication: chnlNo, item: itemArray
});
}
// 구매전환 트래커
order_id = s_ord_no;
order_price = parseInt(ordPay) + '';
// adinsight 주문 총금액 받아옴. start
TRS_AMT = parseInt(ordPay) + "";
TRS_ORDER_ID = s_ord_no;
// adinsight 주문 총금액 받아옴. end
// adinsight 주문 상품별 아이디 받아옴. start
item_no_list = [];
for (var item_d of window.UIPage.order.order_item_list) {
item_no_list.push(item_d.item_no);
}
TRS_PRODUCT = item_no_list.join(" $ ");
// adinsight 주문 상품별 아이디 받아옴. end
// 카카오픽셀 구매완료 스크립트
kakaoMoment.OrderCompleted();
//
// item_detail_list = [];
// for (var item_d of window.UIPage.order.order_item_list) {
// item_detail_list.push({
// id: item_d.item_no,
// name: item_d.item_name,
// quantity: item_d.ord_qty,
// price: parseInt(item_d.sale_price)
// });
// }
//
// ElandmallEventListener.fnAddOnloadListener(function () {
// kakaoScriptProc({
// type: "order",
// proc: function () {
// kakaoPixel('5285479976422128775').purchase({
// products: item_detail_list, // 주문 내 상품 정보(optional)
// total_price: parseInt(ordPay) + "", // 주문 총 가격(optional)
// currency: "KRW", // 주문 가격의 화폐 단위(optional, 기본 값은 KRW)
// total_quantity: item_detail_list ? item_detail_list.length : '' // 주문 내 상품 개수(optional)
// });
// kakaoPixel('7452808054107687571').purchase({
// products: item_detail_list, // 주문 내 상품 정보(optional)
// total_price: parseInt(ordPay) + "", // 주문 총 가격(optional)
// currency: "KRW", // 주문 가격의 화폐 단위(optional, 기본 값은 KRW)
// total_quantity: item_detail_list ? item_detail_list.length : '' // 주문 내 상품 개수(optional)
// });
// }
// });
// });
// // 카카오픽셀 구매완료 스크립트
// // 네이버 프리미엄 로그 분석(Free) 구매완료 스크립트
// naverPremiumLogScriptRun = true;
//
// ElandmallEventListener.fnAddOnloadListener(function () {
// naverPremiumLogScriptProc({
// cnv_type: '1',
// cnv_val: parseInt(ordPay)
// });
//
// if (window.UIPage.mediaDcode == '40') {
// console.log('네이버 프리미엄 로그 분석 ++ ', JSON.stringify({cnv_type: '1', cnv_val: parseInt(ordPay)}));
// } else {
// console.log('네이버 프리미엄 로그 분석 ++ ', {cnv_type: '1', cnv_val: parseInt(ordPay)});
// };
// });
// // 네이버 프리미엄 로그 분석(Free) 구매완료 스크립트
// Facebook Pixel Code && GA Firebase
ordPayParse = parseInt(ordPay);
tax = parseInt(ordPay)*0.1;
ElandmallEventListener.fnAddOnloadListener(function () {
if (typeof (fpq) == "undefined") {
facebookPixelProc();
}
fbq('track', 'Purchase', {
content_ids: item_no_list,
content_type: 'product',
value: ordPayParse,
currency: 'KRW'
});
});
// End Facebook Pixel Code && GA Firebase
// Enliple Tracker Start
ENP_VAR = {
conversion: {product: []}
};
function enpOrderPush() {
for (var item_d of window.UIPage.order.order_item_list) {
ENP_VAR.conversion.product.push({
productCode: item_d.item_no,
productName: item_d.item_name,
price: item_d.sale_price,
dcPrice: (item_d.unit_dc_price == item_d.sale_price) ? "0" : item_d.unit_dc_price,
qty: item_d.ord_qty
});
}
ENP_VAR.conversion.ordCode = window.UIPage.order.ord_no;
ENP_VAR.conversion.totalPrice = ordPay;
ENP_VAR.conversion.totalQty = window.UIPage.order.ord_total_qty;
}
function enpOrderInit(a, g, e, n, t) {
a.enp = a.enp || function () {
(a.enp.q = a.enp.q || []).push(arguments)
};
n = g.createElement(e);
n.defer = !0;
n.src = "https://cdn.megadata.co.kr/dist/prod/enp_tracker_self_hosted.min.js";
t = g.getElementsByTagName(e)[0];
t.parentNode.insertBefore(n, t);
}
function enpTrackerOrderProc() {
enpOrderPush();
enpOrderInit(window, document, 'script');
mobAccount = iskidikidi ? '2001outlet2' : '2001outlet';
if ("Y" == 'N') {
mobDevice = iskidikidi ? 'B' : 'M';
enp('create', 'conversion', mobAccount, {device: mobDevice});
enp('send', 'conversion', mobAccount);
} else {
mobDevice = iskidikidi ? 'B' : 'W';
enp('create', 'conversion', '2001outlet', {device: mobDevice});
enp('send', 'conversion', '2001outlet');
}
}
ElandmallEventListener.fnAddOnloadListener(function () {
enpTrackerOrderProc();
});
// Enliple Tracker End
// Appier 구매완료 스크립트
appierScriptRun = true;
appierRtorderId = window.UIPage.order.ord_no;
itemlist_ap = [];
for (var item_d of window.UIPage.order.order_item_list) {
itemlist_ap.push({
productID: item_d.item_no,
unit: item_d.ord_qty,
price: item_d.sale_price
});
}
appierRtItemList = itemlist_ap;
appierRtPrice = parseInt(ordPay) + '';
appierRtCurrency = "KRW";
function appierOrderScript() {
window.appier_q = window.appier_q || [];
if (s_tr_login_yn == "Y") {
window.appier_q.push(
{"t": "register", "content": {"id": "2bb7", "site": "elandmall.co.kr"}},
{
"t": "type_purchase",
"itemList": appierRtItemList,
"totalvalue": appierRtPrice,
"currency": appierRtCurrency,
"action_id": "3783fed6251db1e",
"track_id": "9b0c3a2004fe566",
"opts": {
"uu": appierRtorderId,
"action_param1": JSON.stringify(appierRtItemList),
"total_revenue": appierRtPrice,
"currency": appierRtCurrency
}
},
{"t": "type_login", "idtype": "email_sha256", "content": s_email_sha256}
);
} else {
window.appier_q.push(
{"t": "register", "content": {"id": "2bb7", "site": "elandmall.co.kr"}},
{
"t": "type_purchase",
"itemList": appierRtItemList,
"totalvalue": appierRtPrice,
"currency": appierRtCurrency,
"action_id": "3783fed6251db1e",
"track_id": "9b0c3a2004fe566",
"opts": {
"uu": appierRtorderId,
"action_param1": JSON.stringify(appierRtItemList),
"total_revenue": appierRtPrice,
"currency": appierRtCurrency
}
}
);
}
}
ElandmallEventListener.fnAddOnloadListener(function () {
appierScriptProc({callback: appierOrderScript});
});
// Appier 구매완료 스크립트
/* 첫구매 여부 및 마지막 구매일 API */
eAjax.get({
type: "get",
// url: '/api/od/search/first-purchase',
url: '/api/od/search/purchases',
dataType: "json",
contentType: "application/json"
}).done(function (response) {
if (response != null) {
console.log(response);
if (response.firstPurchaseYn == 'Y') { // 첫구매인 경우
try {
firstOrderLastOrder();
} catch (err) {
console.log("firstOrderLastOrder() ERR : " + err);
}
}
}
}).fail(function(e) {
console.log("firstPurchseYnLastOrderDt Api ERR : ", e);
});
/* 첫구매 여부 API */
// GA 구매완료 스크립트
var goods = [];
var goods_ga4 = [];
for (var item_d of window.UIPage.order.order_item_list) {
if (item_d.uitem_name != "옵션없음") {
item_d.uitem_name = item_d.uitem_name.replaceAll(",", "/");
}
try {
tracking_ctg_path_list = [];
disp_l_category = item_d.disp_lcategory;
tracking_ctg_path_list.push(disp_l_category.replaceAll('/', ','))
disp_m_category = item_d.disp_mcategory;
tracking_ctg_path_list.push(disp_m_category.replaceAll('/', ','))
disp_s_category = item_d.disp_scategory;
tracking_ctg_path_list.push(disp_s_category.replaceAll('/', ','))
} catch { // ignore
}
goods.push({
name: item_d.item_name,
id: item_d.item_no,
price: item_d.sale_price,
brand: item_d.brand_name,
variant: item_d.uitem_name,
quantity: item_d.ord_qty,
category: tracking_ctg_path_list.join('/'),
coupon: (item_d.coupon_name) ? (item_d.coupon_name) : '',
dimension10: item_d.bundle_item_no
});
var sizeColor = ga4Events._extractSizeColor(item_d.item_options);
goods_ga4.push({
item_name: item_d.item_name,
item_id: item_d.item_no,
currency:"KRW",
price: item_d.unit_dc_price,
item_brand: item_d.brand_name,
// variant: item_d.uitem_name,
quantity: item_d.ord_qty,
item_category:item_d.disp_lcategory,
item_category2:item_d.disp_mcategory,
item_category3:item_d.disp_scategory,
uitem_name: (item_d.uitem_name) ? item_d.uitem_name : '옵션없음',
size: sizeColor.size,
color: sizeColor.color,
});
}
if ((typeof goods != 'undefined') && (goods.length >= 10)) {
for (let i = 0; i < Math.ceil(goods.length/10); i++) {
// GA4
ga4Events.Purchase(goods_ga4.slice((i*10), (i*10)+10));
}
} else {
// GA4
ga4Events.Purchase(goods_ga4);
}
// GA 구매완료 스크립트
// 구매완료
if (platform == '40') {
try {
chlNo = ""
if (dispMallNo == "0000014") {
chlNo = "DPA"
}
// 2-18 UTM 파라미터 추가
utm_data = { utm_source : (window.UIPage.utmMap.utm_source) ? (window.UIPage.utmMap.utm_source) : '',
medium : (window.UIPage.utmMap.medium) ? (window.UIPage.utmMap.medium) : '',
campaign : (window.UIPage.utmMap.campaign) ? (window.UIPage.utmMap.campaign) : '',
campaign_id : (window.UIPage.utmMap.campaign_id) ? (window.UIPage.utmMap.campaign_id) : '',
term : (window.UIPage.utmMap.term) ? (window.UIPage.utmMap.term) : '',
content : (window.UIPage.utmMap.content) ? (window.UIPage.utmMap.content) : ''
};
item_data = { item_data : window.UIPage.order };
window.setTimeout(function () { // 안드로이드 에러 방지 (stack -> queue) // 2-18 UTM 파라미터 추가
Flutter.purchase(String(window.UIPage.order.coupon_names), "KRW", String(ordPayParse), String(tax), String(window.UIPage.order.total_del_amount), String(s_ord_no), String(chlNo), item_data, window.UIPage.loginId, utm_data);
}, 10);
// Flutter.purchase(String(window.UIPage.order.coupon_names), "KRW", String(ordPayParse), String(tax), String(window.UIPage.order.total_del_amount), String(s_ord_no), String(chlNo));
} catch {
console.log('Flutter.purchase ERR : ');
}
} else {
// Braze
try{
brazeEvents.OrderCompleted();
} catch (err) {
console.log('Braze 구매완료 Purchase ERR ' + err);
}
// Braze
}
try {
airbridgeEvents.OrderCompleted(); // 주문서 단위
naverPremiumLogEvents.OrderCompleted(); // 주문서 단위
window.setTimeout(function () { // 상품 단위
airbridgeEvents.OrderCompletedItems(); // 상품 단위
}, 50);
if (dispMallNo == "0000113") {
rtbhouseEvents.OrderCompleted(item_no_list);
}
} catch (err) {
console.log("OrderCompleted Event ERR : " + err);
}
}
}
