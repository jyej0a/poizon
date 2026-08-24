
(function () {
$(function () {
var $rItemView = $('section[data-cp=MainWing] [data-item-view]');
var _rItemView = $rItemView.data('ItemView');
var getCurrency = function (num) {
var r = Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
return r;
};
const urlParams = new URLSearchParams(window.location.search);
const isChatbot = urlParams.get('directChatbotYn') === 'Y';
if (isChatbot) {
const link = document.getElementById('chatBotOpenBtn');
if (link) {
link.click();
urlParams.delete('directChatbotYn');
let baseUrl = window.location.pathname;
const baseParams = urlParams.toString();
if (baseParams) {
baseUrl += '?' + baseParams;
}
window.history.replaceState(null, null, baseUrl);
}
}
function getRecentItemGnbHtml() {
eAjax.get({
type: "GET",
dataType: "json",
contentType: "application/json",
url: "/v1/item/recentseen/api"
}).done(function (response) {
if (response.resultCode == '200') {
if ((response.data != null) && (response.data.item.length)) {
var strHtml = (function () {
var r = [];
response.data.item.forEach(function (item) {
var imagePath = item.representImagePath;
var displayImagePath = 'https://dev-static.elandrs.com/f/img/no_image_600x600.png';
if (imagePath != '') {
displayImagePath = ImageUtil.getCdnFullPath(imagePath);
}
r.push('<li>');
r.push('<a href="/i/item?itemNo=' + item.itemNo + '&lowerVendNo=' + item.lowerVendNo + '" class="wing-goods-link" data-cttn="' + item.marketingData + '"');
r.push(' data-ga-con="select_item" data-ga-key="ecommerceLogEvent" data-ga-params="{&quot;page_area&quot;:&quot;&quot;,&quot;items&quot;:[{&quot;item_id&quot;:&quot;'+(item.itemNo || '')+'&quot;,&quot;item_name&quot;:&quot;'+(item.itemName.replace(/[\'\"]/gi,"") || '')+'&quot;,&quot;currency&quot;:&quot;KRW&quot;,&quot;item_brand&quot;:&quot;'+(item.brandName || '')+'&quot;,&quot;item_category&quot;:&quot;'+(item.dispCategoryName || '')+'&quot;,&quot;price&quot;:&quot;'+(item.sellprice || '')+'&quot;}]}">');
r.push('<div class="is-square" data-square-img>');
r.push('<div class="js-picture">');
r.push('<img src="https://static.elandrs.com/f/img/blank.gif" data-srcset="' + displayImagePath + '" width="58" height="58" alt="">');
r.push('</div>');
r.push('</div>');
r.push('<span class="wing-goods-info">');
r.push('<strong>[' + item.brandName + '] ' + item.itemName + '</strong>');
r.push(getCurrency(item.finalDcPrice) + '원');
r.push('</span>');
r.push('</a>');
r.push('<a href="#" class="wing-goods-delete" data-item-no="' + item.itemNo + '" data-item-del><span class="blind">상품 삭제<span></a>');
r.push('</li>');
});
return r.join('');
})();
_rItemView.itemList.empty();
_rItemView.add({
item: strHtml
});
} else {
_rItemView.itemList.empty();
_rItemView.add({
item: ''
});
}
$rItemView.removeClass('standby');
}
});
}
window.onpageshow = function (e) {
if (e.persisted || (window.performance && window.performance.navigation.type == 2)) {
// Back Forward Cache or History Back - 최근본상품 reload
getRecentItemGnbHtml();
}
}
getRecentItemGnbHtml();
$rItemView.on('ItemViewDel', function (e, data) {
var $t = $(data.e.currentTarget);
var itemNo = $t.attr('data-item-no');
eAjax.get({
type: "DELETE",
dataType: "json",
contentType: "application/json",
url: "/v1/item/recentseen/api/" + itemNo,
async: true
});
});
});
})();
