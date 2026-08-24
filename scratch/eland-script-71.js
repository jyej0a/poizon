
var s_kwd = "CW2288-111";
try {
ga4Events.Search(s_kwd); // GA4
airbridgeEvents.Search();
} catch (err) {
console.log("search Event ERR" + err);
}
