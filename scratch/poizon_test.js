const crypto = require('crypto');

function generateSignature(payload, appSecret) {
  const sortedKeys = Object.keys(payload).sort();
  let signString = '';
  for (const key of sortedKeys) {
    let val = payload[key];
    if (val === null || val === undefined) val = '';
    else if (typeof val === 'object') val = JSON.stringify(val);
    signString += key + val;
  }
  signString += appSecret;
  return crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
}

async function request(endpoint, params) {
    const appKey = "a6ae1ec394264fa68e3dd5f9bbb5550e";
    const appSecret = "b061f0502c5c49cfaf1e7cda80c7eca1";
    const payload = {
      appKey,
      timestamp: Date.now(),
      version: "1.0",
      ...params
    };
    payload.sign = generateSignature(payload, appSecret);
    
    const res = await fetch("https://open.poizon.com" + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    return JSON.parse(text);
}

async function main() {
    const searchRes = await request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-article-number", {
        articleNumber: "TLTCM26601",
        region: "KR",
        sellerStatusEnable: false,
        buyStatusEnable: false
    });
    require('fs').writeFileSync('scratch/searchRes.json', JSON.stringify(searchRes, null, 2));
    
    const data = searchRes.data || searchRes;
    const spuId = data[0]?.spuInfo?.spuId || data[0]?.spuId || data[0]?.goodsId;
    console.log("SPU ID found:", spuId);
    
    if (spuId) {
        const statsRes = await request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/spu-statistics", {
            spuIds: [spuId],
            region: "KR"
        });
        require('fs').writeFileSync('scratch/statsRes.json', JSON.stringify(statsRes, null, 2));
        
        const skuId = data[0]?.skuDetails?.[0]?.skuId || data[0]?.skuList?.[0]?.skuId;
        if (skuId) {
            console.log("SKU ID found:", skuId);
            const recRes = await request("/dop/api/v1/pop/api/v1/intl-commodity/intl/sku/recommend-bidding", {
                skuIds: [skuId],
                region: "KR"
            });
            require('fs').writeFileSync('scratch/recRes.json', JSON.stringify(recRes, null, 2));
        }
    }
}
main().catch(console.error);
