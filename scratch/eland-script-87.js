
(function (isUndefined) {
$(function () {
window._front.getCartCnt();
var _clkFrom = new URLSearchParams(location.search).get('clk-from');
if (!window._tuho_clk_from_param && _clkFrom) {
window._tuho_clk_from_param = "clk_from=" + (_clkFrom) + "&";
}
var setUIPageParams = function (param, count, failKeywordYn) {
//UIPage-searchResult initial value
//window.UIPage.searchResult.filterString =Object.entries(param).map(e => e.join('=')).join('&');ss
window.UIPage.searchResult.filterString = Object.entries(param).map(function (e) {
return e.join('=')
}).join('&');
window.UIPage.searchResult.count = count;
window.UIPage.searchResult.failKeywordYn = failKeywordYn;
if (window.TuhoPageDetailInfo) {
window.dispatchEvent(window.TuhoPageDetailInfo);
}
console.log(window.UIPage.searchResult);
};
function decodeHtml(html) {
var txt = document.createElement("textarea");
txt.innerHTML = html;
return encodeURIComponent(txt.value);
}
// searchForm
var $SearchForm = $('#searchForm');
var $saveFilterWrap = $SearchForm.find('[data-savefilter-category], [data-savefilter-wrap]');
var $Price = $SearchForm.find('[data-range-wrap]');
var $Rate = $SearchForm.find('[data-discount-wrap]');
var $Sort = $('#sort');
var $Size = $('#pageSize');
var Util = window.EB.util;
var macroType = window.UIPage.dispMallNo === '0000033' ? "srch_eblin" : "srch";
var defParams = {
q: "CW2288-111",
macroClass: "ui-item time-day",
macroType: macroType,
width: "500",
height: "500",
'prop.multiThumbnail': 'Y'
};
var trkParams = {
pageId: "",
preCornerNo: ""
};
setUIPageParams(defParams, 1, 'N');
var $pagingWrap = $('#searchResultPaging');
var setParams = function () {
var _serialize = decodeURIComponent($SearchForm.serialize().replace(/%2F/g, " "));
var serialParam = (function () {
var r = {};
if (_serialize.length) {
var as = _serialize.split('&');
as.forEach(function (a) {
var bs = a.split('=');
var bs1 = bs[0];
var bs2 = bs[1];
if (r.hasOwnProperty(bs1)) {
r[bs1] = r[bs1] + "," + bs2;
} else {
r[bs1] = bs2;
}
});
}
return r;
})();
var priceParam = (function () {
var r = {};
var min = $Price.find('[data-range-min]').text().replace(/,/g, '');
var max = $Price.find('[data-range-max]').text().replace(/,/g, '');
r.minPrice = min.length && !isNaN(min) ? parseInt(min) : 142200;
r.maxPrice = max.length && !isNaN(max) ? parseInt(max) : 142200;
if (r.minPrice < 0) {
r.minPrice = 0;
}
return r;
})();
var rateParam = (function () {
var r = {};
if ($Rate.find('[data-discount-min]').length || $Rate.find('[data-discount-max]').length) {
var min = $Rate.find('[data-discount-min]').val().length ? parseInt($Rate.find('[data-discount-min]').val()) : 0;
var max = $Rate.find('[data-discount-max]').val().length ? parseInt($Rate.find('[data-discount-max]').val()) : 100;
r.minRate = min <= 0 ? 0 : (min > 100 ? 100 : min);
r.maxRate = max <= 0 || max > 100 ? 100 : max;
}
return r;
})();
var sortParam = (function () {
var r = {};
var $activeEl = $Sort.children().filter('.active');
if ($activeEl.length) {
r.sort = $activeEl.find('[data-code]').data('code');
}
return r;
})();
var sizeParam = (function () {
var r = {};
r.size = parseFloat($Size[0].value);
return r;
})();
var viewParam = (function () {
var r = {};
r.viewType = $('ul[data-category-view-btnwrap]>li[data-category-view-btn].active').eq(0).attr('data-category-view-btn');
return r;
})();
return Util.def({}, defParams, trkParams, serialParam, priceParam, rateParam, sortParam, sizeParam, viewParam);
};
var ajaxDone = function (e, props) {
var deferred = $.Deferred();
var doneParams = setParams();
var type = props.type;
if (props.hasOwnProperty('data')) {
Util.def(doneParams, props.data);
}
var target = 1;
if (type == 'paging') {
var $t = $(e.currentTarget);
var totalCount = Pagination.opts.total;
var size = Pagination.opts.size;
var current = $pagingWrap.find('[data-paging-btn].active').data('value');
var target = null;
if ($t.data('paging-btn') != undefined) {
target = $t.data('value');
} else {
if ($t.hasClass('btn_paging_first')) {
target = 1;
} else if ($t.hasClass('btn_paging_prev')) {
target = current - 1;
if (target < 1) {
target = 1;
}
} else if ($t.hasClass('btn_paging_next')) {
target = current + 1;
var totalPage = Math.ceil(totalCount / size);
if (target > totalPage) {
target = totalPage;
}
} else if ($t.hasClass('btn_paging_last')) {
target = Math.ceil(totalCount / size);
}
}
}
doneParams.page = target;
doneParams.from = (target - 1) * Pagination.opts.size;
HtmlApi.searchItem(Pagination.parseData(e, {
data: doneParams,
callback: function (response) {
Pagination.setData({
e: e,
response: response
});
pageDynamicViewLoader.categoryList.render($("#searchPageList"), doneParams);
$('[data-searchresult-total]').text(Pagination.opts.total.toLocaleString());
if (Pagination.opts.total > 0) {
$('.cm-category-view .cm-section-msg').css('display', 'none');
} else {
$('.cm-category-view .cm-section-msg').css('display', 'block');
$('#searchPageList').empty();
}
if (!props.skipPushState) {
var ParamString = (window._tuho_clk_from_param || '') + Object.entries(doneParams).map(function (e) {
if (e[0] === 'q') {
return e[0] + '=' + decodeHtml(e[1])
} else {
return e.join('=')
}
}).join('&');
history.pushState(null, '', '/s/srch?' + ParamString);
}
deferred.resolve();
}
}));
return deferred.promise();
};
var Pagination = $pagingWrap.data('ePagination');
try {
if (Pagination) {
pageDynamicViewLoader.categoryList.render($("#searchPageList"), Pagination.opts);
}
} catch (err) {console.log(err);}
$Price.find('[data-range-slider]').on('RangeChangeEnd', function (e) {
ajaxDone(null, {
type: 'change'
});
});
$Rate.find('[data-discount-option]').on('click', function (e) {
ajaxDone(null, {
type: 'change'
});
});
$Rate.find('[data-discount-btn]').on('click', function (e) {
ajaxDone(null, {
type: 'change'
});
});
$Sort.find('[data-code]').on('click', function (e) {
var $t = $(e.currentTarget);
ajaxDone(null, {
type: 'change',
data: {
sort: $t.data('code')
}
});
});
$Size.on('change', function (e) {
ajaxDone(null, {
type: 'change'
});
});
// 활성화 필터내 삭제 클릭
$('[data-lnbfilter-controlbox] .tag_list').on('click', 'a', function (e) {
e.preventDefault();
ajaxDone(null, {
type: 'change'
});
});
// 바닥 페이지내 전체해제 클릭
$('[data-lnbfilter-controlbox]').on('click', '.btn-reset', function (e) {
e.preventDefault();
ajaxDone(null, {
type: 'change'
});
});
$SearchForm.on('change', 'input[type="radio"],input[type="checkbox"]', function (e) {
var $t = $(e.currentTarget);
var $hasCategory = $t.closest('[data-ecategory-type]');
if ($hasCategory.length) {
var $parentChild = $t.parentsUntil($hasCategory).last();
$parentChild.siblings().find('input').prop('checked', false);
}
ajaxDone(null, {
type: 'change'
});
});
$pagingWrap.on('click', 'a', function (e) {
e.preventDefault();
if (Pagination != undefined) {
ajaxDone(e, {
type: 'paging'
});
}
});
$('[data-category-view-btn]').on('click', 'a', function (e) {
var $t = $(e.currentTarget);
var $type = $t.closest('li').eq(0).attr('data-category-view-btn');
var currentQueryParam = new URLSearchParams(location.search);
currentQueryParam.set('viewType', $type);
console.log(window._tuho_clk_from_param);
var ParamString = Array.from(currentQueryParam.entries()).map(function (e) {
if (e[0] === 'q') {
return e[0] + '=' + decodeHtml(e[1]);
} else {
return e[0] + '=' + e[1];
}
}).join('&');
console.log(ParamString)
history.replaceState(null, '', '/s/srch?' + (window._tuho_clk_from_param||'') + ParamString);
});
var setViewType = function (key, value) {
var $t = $('ul[data-category-view-btnwrap]>li[data-category-view-btn="' + value + '"]');
if (!$t.hasClass('active')) {
$t.find('a').eq(0).click();
}
};
var setSortSelected = function (key, value) {
if ($('#sort>li.active>a').eq(0).attr('data-code') != value) {
$('#sort>li').removeClass('active');
$('#sort>li>a[data-code="' + value + '"]').closest('li').addClass('active');
}
};
var setRateInput = function () {
var q = new URLSearchParams(location.search);
var r = {};
for (var p of q.keys()){
if(p === "minRate" || p === "maxRate"){
r[p] = typeof(parseInt(q.get(p))) == "number" ? parseInt(q.get(p)) : p === "minRate" ? 0 : 100;
}
}
$('input[data-discount-min]').val(r.minRate ? r.minRate : 0);
$('input[data-discount-max]').val(r.maxRate ? (r.maxRate == 0 ? 100 : r.maxRate) : 100);
console.log(r, $('input[data-discount-min]').val(), $('input[data-discount-max]').val());
let min = $('input[data-discount-min]').val();
$('#rateBtn>ul>li').find('[data-discount-option != "'+min+'"]').removeClass('active');
if(parseInt($('input[data-discount-max]').val()) == 100){
$('#rateBtn>ul>li').find('[data-discount-option = "'+min+'"]').addClass('active');
}
};
var setFilterChecked = function () {
var params = (function () {
var q = new URLSearchParams(location.search);
var r = {};
for (var p of q.keys()) {
r[p] = q.get(p).split(',');
}
return r;
})();
var $inputs = $saveFilterWrap.find('input');
var view = function (i) {
var $input = $inputs.eq(i);
var _name = $input.attr('name');
var _val = $input.attr('value');
if (params.hasOwnProperty(_name) && (params[_name].indexOf(_val) != -1)) {
$input.prop('checked', true);
} else {
$input.prop('checked', false);
}
};
for (var i = 0, max = $inputs.length; i < max; i++) {
view(i);
}
}
var setFiltersActive = function (key) {
var params = new URLSearchParams(location.search);
switch (key) {
case "sort":
setSortSelected(key, params.get(key));
break;
case "viewType":
setViewType(key, params.get(key));
break;
}
};
let syncfilterPage = function () {
var $lnbFilter = $('[data-cm-lnbfilter]');
var filterInst = $lnbFilter.data('CmLnbFilter');
if (filterInst != isUndefined) {
filterInst.params.searchview();
}
var $paging = $('#searchResultPaging');
var pagingInst = $paging.data('ePagination');
if (pagingInst != isUndefined) {
pagingInst.params.searchview();
}
};
var params = new URLSearchParams(location.search);
setRateInput();
setFilterChecked();
for (const key of params.keys()) {
setFiltersActive(key);
}
syncfilterPage();
addEventListener("popstate", (event) => {
var params = new URLSearchParams(location.search);
setRateInput();
setFilterChecked();
for (const key of params.keys()) {
setFiltersActive(key);
}
ajaxDone(null, {
type: 'change',
skipPushState: true
}).done(function () {
syncfilterPage();
});
});
});
})();
