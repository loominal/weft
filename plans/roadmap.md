# Roadmap

## Batch 1 (Foundation - ALL PARALLEL)

### Phase 1.1: Create Pagination Utilities Module
- **Status:** ✅ Complete
- **Tasks:**
  - [ ] Copy Warp pagination.ts to weft/src/utils/pagination.ts
  - [ ] Adapt for Express REST API (vs MCP tool args)
  - [ ] Add parsePaginationQuery() for req.query parsing
  - [ ] Add unit tests (pagination.test.ts)
  - [ ] Verify all helpers work with REST context
- **Effort:** M
- **Done When:** All Warp pagination utilities ported, Express helpers added, 15+ tests passing, type-safe
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-11-create-pagination-utilities-module-)
- **Files:** `weft/src/utils/pagination.ts` (new), `weft/src/utils/__tests__/pagination.test.ts` (new)

### Phase 1.2: Add Pagination Types to @loominal/shared
- **Status:** ✅ Complete
- **Tasks:**
  - [ ] Add PaginationState interface to shared/src/types.ts
  - [ ] Add PaginationMetadata interface
  - [ ] Add PaginationCursor type alias
  - [ ] Export from shared/src/index.ts
  - [ ] Build shared package
- **Effort:** S
- **Done When:** Types exported from @loominal/shared, build passes, types available in weft
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-12-add-pagination-types-to-loominalshared-)

### Phase 1.3: Add Semantic Context Types to @loominal/shared
- **Status:** ✅ Complete
- **Tasks:**
  - [ ] Add AgentSummary interface (minimal agent info)
  - [ ] Add WorkItemResponse with assignedToAgent field
  - [ ] Add TargetResponse with lastSpinUp.agent field
  - [ ] Add ChannelMessageResponse with senderAgent field
  - [ ] Export from shared/src/index.ts
- **Effort:** S
- **Done When:** All semantic context types defined, backward compatible, build passes
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-13-add-semantic-context-types-to-loominalshared-)

### Phase 1.4: Standardize Parameter Naming (Support Both)
- **Status:** ✅ Complete
- **Tasks:**
  - [ ] Update /api/work GET to accept boundary OR classification
  - [ ] Update /api/targets GET to accept boundary OR classification
  - [ ] Add deprecation header when old param used
  - [ ] Update parameter parsing to prefer boundary
  - [ ] Add tests for both parameter names
- **Effort:** S
- **Done When:** Both params work, deprecation header added, tests verify both, no breaking changes
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-14-standardize-parameter-naming-support-both-)
- **Files:** `weft/src/api/routes/work.ts`, `weft/src/api/routes/targets.ts`

### Phase 1.5: Add Batch Operation Types to @loominal/shared
- **Status:** ✅ Complete
- **Tasks:**
  - [ ] Add BatchShutdownRequest interface
  - [ ] Add BatchShutdownResponse interface
  - [ ] Add BatchDisableTargetsRequest interface
  - [ ] Add BatchCancelWorkRequest interface
  - [ ] Add generic BatchOperationResponse interface
  - [ ] Export from shared/src/index.ts
- **Effort:** S
- **Done When:** All batch types defined, support filter-based selection, responses include details, build passes
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-15-add-batch-operation-types-to-loominalshared-)

---

## Batch 2 (Core Features - ALL PARALLEL)

### Phase 2.1: Add Pagination to /api/agents Endpoint
- **Status:** ✅ Complete
- **Depends On:** Phase 1.1, 1.2, 1.4 (✅ Complete)
- **Tasks:**
  - [ ] Import pagination utilities in agents.ts
  - [ ] Parse cursor and limit query params
  - [ ] Update service.listAgents() to accept pagination options
  - [ ] Add offset/limit logic to coordinator
  - [ ] Return PaginationMetadata in response
  - [ ] Add unit tests for paginated responses
  - [ ] Test cursor validation and filter consistency
- **Effort:** M
- **Done When:** Pagination works with 50 default limit, response includes metadata, backward compatible, tests pass
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-21-add-pagination-to-apiagents-endpoint-)
- **Tests:** 9 new pagination tests, 199 total tests passing

### Phase 2.2: Add Pagination to /api/work Endpoint
- **Status:** ✅ Complete
- **Depends On:** Phase 1.1, 1.2, 1.4 (✅ Complete)
- **Tasks:**
  - [ ] Import pagination utilities in work.ts
  - [ ] Parse cursor and limit query params
  - [ ] Update service.listWork() to accept pagination options
  - [ ] Add offset/limit logic to coordinator
  - [ ] Return PaginationMetadata in response
  - [ ] Add unit tests
- **Effort:** M
- **Done When:** Same pagination behavior as agents endpoint, works with filters, tests pass
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-22-add-pagination-to-apiwork-endpoint-)
- **Tests:** 16 new pagination tests, 190 total tests passing

### Phase 2.3: Add Pagination to /api/targets Endpoint
- **Status:** ✅ Complete
- **Depends On:** Phase 1.1, 1.2, 1.4 (✅ Complete)
- **Tasks:**
  - [ ] Import pagination utilities in targets.ts
  - [ ] Parse cursor and limit query params
  - [ ] Update service.listTargets() to accept pagination options
  - [ ] Add offset/limit logic to target registry
  - [ ] Return PaginationMetadata in response
  - [ ] Add unit tests
- **Effort:** M
- **Done When:** Same pagination behavior as other endpoints, tests pass
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-23-add-pagination-to-apitargets-endpoint-)
- **Tests:** 6 new pagination tests, 199 total tests passing

### Phase 2.4: Add Semantic Context to Work Items
- **Status:** ✅ Complete
- **Depends On:** Phase 1.3 (✅ Complete)
- **Tasks:**
  - [ ] Update GET /api/work/:id to resolve assignedToAgent
  - [ ] Update GET /api/work (list) to resolve agents
  - [ ] Add resolveAgentSummary(guid) helper in coordinator
  - [ ] Maintain assignedTo field for backward compatibility
  - [ ] Add tests verifying resolved agent details
- **Effort:** M
- **Done When:** Work items include assignedToAgent object, original GUID still present, handles missing agents, tests verify structure
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-24-add-semantic-context-to-work-items-)
- **Tests:** 13 new semantic context tests, 199 total tests passing

### Phase 2.5: Add Semantic Context to Targets
- **Status:** ✅ Complete
- **Depends On:** Phase 1.3 (✅ Complete)
- **Tasks:**
  - [ ] Update GET /api/targets/:id to include lastSpinUp.agent
  - [ ] Update GET /api/targets (list) to include spin-up details
  - [ ] Track last spin-up in target registry
  - [ ] Add tests verifying spin-up context
- **Effort:** M
- **Done When:** Targets include lastSpinUp object with agent details, tests verify structure
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-25-add-semantic-context-to-targets-)
- **Tests:** 7 new spin-up context tests, 195 total tests passing

### Phase 2.6: Implement Batch Operation Endpoints
- **Status:** ✅ Complete
- **Depends On:** Phase 1.5 (✅ Complete)
- **Tasks:**
  - [ ] Add POST /api/agents/shutdown-batch endpoint
  - [ ] Add POST /api/targets/disable-batch endpoint
  - [ ] Add POST /api/work/cancel-batch endpoint
  - [ ] Implement filter-based selection logic
  - [ ] Return detailed success/failure results
  - [ ] Add comprehensive tests
  - [ ] Test error handling (partial failures)
- **Effort:** M
- **Done When:** All 3 batch endpoints work, filter and GUID selection, partial failure handling, detailed errors, tests pass
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-26-implement-batch-operation-endpoints-)
- **Tests:** 18 new batch operation tests, 208 total tests passing

---

## Batch 3 (Documentation & Validation)

### Phase 3.1: Create OpenAPI 3.0 Specification
- **Status:** ✅ Complete
- **Depends On:** All Batch 2 phases (✅ Complete)
- **Tasks:**
  - [x] Install OpenAPI tooling (@apidevtools/swagger-cli)
  - [x] Create weft/openapi.yaml with full API spec
  - [x] Document all 15+ endpoints with schemas
  - [x] Add request/response examples
  - [x] Document query parameters, headers, status codes
  - [x] Define reusable schemas in components/schemas
  - [x] Validate spec with swagger-cli validate
- **Effort:** M
- **Done When:** Complete OpenAPI 3.0 spec, all schemas defined, examples included, spec validates
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-31-create-openapi-30-specification-)
- **Deliverable:** `openapi.yaml` (1,886 lines, 24 endpoints, 23 schemas, 30+ examples, validates successfully)

### Phase 3.2: Add Swagger UI Endpoint (/api/docs)
- **Status:** ✅ Complete
- **Depends On:** Phase 3.1 (✅ Complete)
- **Tasks:**
  - [x] Install swagger-ui-express package
  - [x] Add /api/docs route serving Swagger UI
  - [x] Add /api/openapi.json route serving spec
  - [x] Configure Swagger UI with branding
  - [x] Test interactive API explorer
  - [x] Add documentation link to health endpoint
- **Effort:** S
- **Done When:** GET /api/docs displays Swagger UI, GET /api/openapi.json returns spec, all endpoints testable
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-32-add-swagger-ui-endpoint-apidocs-)
- **Deliverable:** Interactive Swagger UI at `/api/docs`, JSON spec at `/api/openapi.json`

### Phase 3.3: Add Runtime OpenAPI Validation
- **Status:** ✅ Complete
- **Depends On:** Phase 3.1 (✅ Complete)
- **Tasks:**
  - [x] Install express-openapi-validator
  - [x] Add validation middleware to Express app
  - [x] Configure validator to use openapi.yaml
  - [x] Add error handler for validation failures
  - [x] Test request validation (400 errors)
  - [x] Test response validation
- **Effort:** M
- **Done When:** Invalid requests rejected with 400, response validation catches bugs, doesn't break valid requests, helpful errors
- **Plan:** [v0.2.0-implementation-plan.md](./v0.2.0-implementation-plan.md#phase-33-add-runtime-openapi-validation-)
- **Tests:** All 208 existing tests pass, validation working correctly

---

## Backlog

- [ ] Response caching headers for stats endpoints (v0.3.0)
- [ ] WebSocket subscriptions for real-time updates (v0.3.0)
- [ ] High availability / clustering support (v1.0.0)
- [ ] Persistent storage (Redis/PostgreSQL) (v1.0.0)
- [ ] Metrics + observability (v1.0.0)
- [ ] Production-grade authentication (v1.0.0)
