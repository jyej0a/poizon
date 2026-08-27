const UA = "Mozilla/5.0";
const hiverToken =
  "3b17176f2eb5fdffb9bafdcc3e4bc192b013813caddccd0aad20c23ed272f076_1423639497";

async function main() {
  const brandi = await fetch(
    "https://capi.brandi.co.kr/v1/web/search/products/%EC%9B%90%ED%94%BC%EC%8A%A4?offset=0&limit=2&version=2301&total-count=true&service-type=brandi",
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Origin: "https://www.brandi.co.kr",
        Referer: "https://www.brandi.co.kr/search?q=%EC%9B%90%ED%94%BC%EC%8A%A4",
        Authorization: hiverToken,
        sid: hiverToken,
      },
    }
  );
  const bj = await brandi.json();
  const p = bj.data?.products?.[0];
  console.log("brandi count", bj.data?.total_count, "sample keys", p ? Object.keys(p) : null);
  if (p) console.log("brandi sample", JSON.stringify(p).slice(0, 700));

  const query = `query GetSearchResult($input: SearchResultInput!) {
    search_result(input: $input) {
      total_count
      searched_keyword
      ui_item_list {
        type
        ... on UxGoodsCardItem {
          type
          position
          image_url
          product_url
          title
        }
      }
    }
  }`;
  const zig = await fetch("https://api.zigzag.kr/api/2/graphql", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Origin: "https://zigzag.kr",
      Referer: "https://zigzag.kr/search?keyword=JWJGX25211",
    },
    body: JSON.stringify({
      operationName: "GetSearchResult",
      query,
      variables: { input: { query: "JWJGX25211", limit: 5 } },
    }),
  });
  const zt = await zig.text();
  console.log("zigzag", zig.status, zt.slice(0, 800).replace(/\s+/g, " "));
}

main().catch(console.error);
