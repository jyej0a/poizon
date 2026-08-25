# Poizon API Documentation (Deep Crawl Edition)

This comprehensive document serves as the absolute source of truth for all Poizon OpenAPI interactions, containing the deep-scraped mapping of **36 APIs** under the "Item" and "Listing & Inventory" trees. 

## General Parameters (Common for ALL endpoints)
Every POST request payload must include these fields, unless using a wrapped client that autogenerates them.
- `app_key` (String, Required): Application Identifier
- `access_token` (String, Optional/Conditional): Request Token for seller-specific actions (like Bidding & Listing). **CRITICAL: May be required for submitting bids depending on Seller auth level.**
- `timestamp` (Long, Required): Milliseconds
- `sign` (String, Required): MD5/HMAC Signature
- `language` (String, Required): `ko`, `en`, `zh` etc.
- `timeZone` (String, Required): `Asia/Seoul`

---

## 🏗 CATEGORY 1: Item (30+ Definitions)

### 1.1 SPU & SKU Basic Information Queries
*   **by-article-number**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-article-number` (Item No.)
*   **by-brandId**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-brandId` (Batch)
*   **scroll-by-brandId**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/scroll-by-brandId`
*   **by-barcodes**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-barcodes`
*   **by-spu-ids** (DW spuId): `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-spu-ids`
*   **by-sku-ids** (DW skuId): `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-sku-ids`
*   **by-custom-code** (Seller ID): `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-custom-code`
*   **by-categoryId**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/spu/spu-basic-info/by-categoryId`
*   **by-global-spu**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-global-spu`
*   **by-global-sku**: `POST /dop/api/v1/pop/api/v1/intl-commodity/intl/sku/sku-basic-info/by-global-sku`

**(Note: All above APIs require `region`, `pageNum`/`pageSize` for batches, and specific IDs. They are used to retrieve the internal `skuId` required for listing.)**

---

## 💰 CATEGORY 2: Listing & Inventory (Bidding Control)

### 2.1 Submit Automatic Bidding (Follow-up Bidding)
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/auto-follow-bidding/submit`
- **Purpose**: Creates an automated pricing bot for an *existing* listing. (Changes price when competitors drop).
- **Core Parameters**: `biddingNo` / `sellerBiddingNo`, `lowestPrice`, `followType` (3, 4, 5, 6), `autoSwitch`, `countryCode`, `currency`.
- **Note**: 구 `follow-bidding/submit` 은 실데이터 404.

### 2.2 Query Automatic Follow-Up Bidding List
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/auto-follow-bidding/list`
- **Purpose**: Retrieves all automated bidding configurations for the seller.
- **Note**: 실데이터에서 500(system busy)이 날 수 있음. cancel 계열은 404.

### 2.3 Manual Listing (Normal) / Submit Bid **[Primary Initial Bid Action]**
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/submit-bid/normal-autonomous-bidding`
- **Purpose**: **Standard selling action. Places a new firm bid on the market via "Ship-to-Verify" (Inspect then Ship) flow.**
- **Core Parameters**:
    - `requestId` (String, Required): UUID for idempotency.
    - `skuId` (Number): The Poizon internal DW skuId.
    - `globalSkuId` (Number): Can be used interchangeably with skuId.
    - `price` (Number, Required): The exact listing price (e.g., 150000).
    - `quantity` (Number, Required): Number of items (e.g., 1).
    - `countryCode` (String, Required): Seller country (e.g., KR).
    - `deliveryCountryCode` (String, Required): Dispatch origin (e.g., KR).
    - `currency` (String, Optional): Listing currency (CNY, USD, KRW - Note: Support varies by item/region).
    - `biddingType` (Number, Required): `20` (Ship-to-Verify). **CRITICAL for International Sellers.**
    - `saleType` (Number, Required): `0` (Normal Sale).
    - `sizeType` (String, Required): `EU`, `US`, `UK` etc. (Required for normal bidding).

### 2.4 Cancel Listing (Withdraw Bid)
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/cancel-bid/cancel-bidding`
- **Purpose**: Revokes an active bid from the market.
- **Core Parameters**: `sellerBiddingNo`

### 2.5 Query Listing List
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/retrieve-bid/general-type-bidding-list`
- **Docs**: https://open.poizon.com/doc/list/apiDetail/51
- **Purpose**: Seller listing list (Ship-to-Verify / Pre-sale / Consignment / Direct).
- **Core Parameters**: `tradeStatus` (0 in transaction · 1 canceled · 2 listing successful · 3 sell out), `biddingType` (20 / 25 / 27), `saleType` (0 Ship-to-Verify · 7 Pre-sale), `exclusiveStartOffsetId` (0 first page), `pageSize` (max 100), `region`, `language`, `timeZone`. Optional `sellerBiddingNoList`.
- **Pagination**: response `data.lastOffsetId` → next `exclusiveStartOffsetId`. No total count.
- **Response `data.list[]`**: `sellerBiddingNo`, `skuId`/`globalSkuId`, `spuId`/`globalSpuId`, `spuTitle`, `price`, `quantity`, `onSaleQuantity`, `tradeStatus`, `exposureItemList[]` (`region`, `exposureEnabled`), `regionSalePvInfoList` (size/color), `createTime`.
- **Note**: 구 `POST /dop/api/v1/pop/api/v1/listing/list` 는 실데이터 404. 쓰지 않음.

### 2.6 Update Manual Listing (Ship-to-verify)
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/update-bid/normal-autonomous-bidding`
- **Purpose**: Change price/qty of an existing Ship-to-Verify listing without cancel+resubmit.
- **Core Parameters**: `requestId` (UUID), `sellerBiddingNo`, `skuId`, `price`, `quantity`, plus the same country/currency/size/biddingType/saleType fields as submit.

---

## 📦 CATEGORY 3: Order (체결 후 주문)

### 3.1 Order List (by type)
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/order/generic_list`
- **Docs**: https://open.poizon.com/doc/list/apiDetail/102
- **Purpose**: Seller order list. `skuId`/`spuId` in this API are **global** product IDs.
- **Window**: `start_created` / `end_created` (`yyyy-MM-dd HH:mm:ss`), **max 7 days per call**. Longer ranges are split client-side (cap 90 days).
- **Core Parameters**: `order_type` (`NORMAL_SALE` / `CONSIGN` / `PRE_SALE` / `DIRECT`), `order_status`, `page_no`, `page_size`, `order_by_create_time_desc`, `language`, `timeZone`.
- **Status (order_status)**:
  - `1000` pending payment · `2000` paid / seller to ship · `2100` seller shipped
  - `2200` platform received · `2500` QC done · `2550` waiting platform ship · `2600` platform shipped
  - `2650`~`3040` in transit / waiting buyer · `4000` success
  - `7000` failed · `8000`/`8010` closed · `8080` refund + return
- **Response `data.orders[]`**: `order_no`, `order_type`, `order_status`, `pay_status`, `pay_time`, `amount`, `pay_amount`, `sku_id`, …

### 3.2 Ship Order
- **Endpoint**: `POST /dop/api/v1/pop/api/v1/order/delivery`
- **Docs**: https://open.poizon.com/doc/list/apiDetail/100
- **Purpose**: Mark an order as shipped (Ship-to-Verify: seller ships to POIZON inspection).
- **Core Parameters**: `order_no`, carrier id, tracking no, `delivery_method` (`OFFLINE_EXPRESS_DELIVERY` / `SELF_DELIVERY` / `ONLINE_EXPRESS_DELIVERY`). Documented IDs: UPS 7, FedEx 8, USPS 9, YAMATO 10, SAGAWA 11, DHL 22, Self 100. 「Get Supported Shipping Carriers」 후보는 실데이터 404.
- **QC**: `Query Order QC Result` 후보는 실데이터 404. 목록 `identifyType` / `onlineIdentifyStatus` 사용.

## Final Conclusion on Error [80000014: Authentication not supported for this item]
Based on the full API spec, the `80000014` error occurs when using the `direct-autonomous-bidding` endpoint as an international (KR) seller without specific direct-shipping authentication. 

**The Solution ("비책"):**
1. Use the **`normal-autonomous-bidding`** endpoint.
2. Explicitly set **`biddingType: 20`** (Ship-to-Verify).
3. Provide **`sizeType: "EU"`** (or appropriate region).
4. This routes the item through Poizon's inspection center, which is the standard protocol for cross-border sellers.