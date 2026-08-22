# Characterized behavior and open decisions

These facts intentionally remain unchanged after Stages A and 2. Tests and
fixtures should cite this inventory before a later stage changes one of them.

| Area | Current behavior | Characterization / next decision |
| --- | --- | --- |
| Nutrient metadata | Report DTOs advertise metadata and source fields that persisted enrichment does not populate uniformly. | `FoodServiceTest` and `docs/openapi.yaml` freeze the nullable response fields. Stage 4 must choose one canonical projection. |
| Nutrition targets | Frontend and backend each contain fallback targets and they are not identical. | Feature API fixtures preserve values at their current boundary. Stage 5 must choose the owner before removing either copy. |
| Voice integration | The frontend can start configured Vapi calls while the backend also exposes authenticated `GET /food/voice/token`. | Both routes remain inventoried. The provider-path decision in plan section 14 is still open. |
| Weekly averages | Averages divide by days that contain food logs, not every calendar day requested. | `FoodServiceTest` owns the service behavior; Stage 4 must decide logged-day versus calendar-day semantics. |
| Trend length | `/food/nutrition/all` zero-fills the requested range while `/food/nutrition/weekly` emits only days that have logs. | Both distinct schemas remain in `docs/openapi.yaml`; do not normalize them incidentally. |
| Batch writes | Manual and voice batches can commit a prefix before a later item fails. | Contract fixtures treat partial commits as observable. Transaction policy is a Stage 4 decision. |
| Webhook acknowledgement | Authenticated, bounded provider events still return `200 {"result":"logged"}` when application processing fails, preventing provider retries. | Webhook contract tests freeze the acknowledgement. A durable failure queue/idempotency policy remains open. |
| Food response shapes | Daily, range, and mutation routes expose deliberately different quantity/meal structures. | `FoodControllerContractTest`, frontend feature fixtures, and the OpenAPI schemas freeze all three shapes. |
