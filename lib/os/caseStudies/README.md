# Case Studies Module

Portfolio case studies for Hive OS. Supports internal (full detail) and public (sales-safe) versions of each case study.

## Data Model

```typescript
interface CaseStudy {
  id: string;
  title: string;
  client: string;
  industry: string | null;
  services: string[];
  tags: string[];
  summary: string | null;
  problem: string | null;
  approach: string | null;
  outcome: string | null;
  metrics: Record<string, string | number | boolean | null> | CaseStudyMetric[];
  assets: string[];
  permissionLevel: 'public' | 'internal';
  visibility: 'public' | 'internal'; // Alias for permissionLevel
  caseStudyUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
```

## Permission Filtering

- **`public`**: Visible on website, sales materials, external contexts
- **`internal`**: Internal use only - full client details, sensitive metrics

### Access Control

| Context | Visible Cases |
|---------|--------------|
| Public website | `permissionLevel = 'public'` only |
| Internal app (authenticated) | All (`public` + `internal`) |
| Admin/Settings | All |

## API Routes

### List Case Studies

```
GET /api/os/case-studies
GET /api/os/case-studies?permission=public
GET /api/os/case-studies?permission=internal
GET /api/os/case-studies?q=branding
```

**Query Parameters:**
- `permission` - Filter by `public` or `internal`
- `q` - Search query (title, client, industry, services, tags)

**Response:**
```json
{
  "status": "ok",
  "data": [...],
  "count": 6
}
```

### Get Single Case Study

```
GET /api/os/case-studies/[id]
GET /api/os/case-studies/[id]?permission=public
```

Pass `permission=public` to enforce public-only access (returns 403 for internal case studies).

### Create/Update Case Study

```
POST /api/os/case-studies
Content-Type: application/json

{
  "title": "Case Study Title",
  "client": "Client Name",
  "industry": "Technology",
  "permissionLevel": "internal",
  "visibility": "internal",
  "services": ["Branding", "Strategy"],
  "tags": ["tech", "saas"],
  "summary": "...",
  "problem": "...",
  "approach": "...",
  "outcome": "...",
  "metrics": { "brandClarity": "Improved" }
}
```

Upserts by matching `title + client`. Running twice updates existing record.

### Update Case Study

```
PATCH /api/os/case-studies/[id]
Content-Type: application/json

{ "title": "Updated Title" }
```

### Delete Case Study

```
DELETE /api/os/case-studies/[id]
```

### Seed Case Studies

```
POST /api/os/case-studies/seed
```

Idempotent - seeds MOE, FCTG, and Microsoft case studies. Running twice updates existing records rather than creating duplicates.

**Response:**
```json
{
  "status": "ok",
  "message": "Seeded 6 case studies",
  "data": {
    "total": 6,
    "success": 6,
    "errors": 0,
    "results": [...]
  }
}
```

## Seeding

### Via API

```bash
curl -X POST http://localhost:3000/api/os/case-studies/seed
```

### Seed Data

Located in `/lib/os/caseStudies/seed.ts`:

| Client | Internal | Public |
|--------|----------|--------|
| MOE Brand | Building a Distinct, Flexible Brand System for MOE | Creating a Scalable Brand Identity for MOE |
| FCTG | Clarifying Brand Positioning and Trust for FCTG | Strengthening Brand Clarity and Credibility for FCTG |
| Microsoft | Supporting Enterprise Brand and Content Initiatives | Enterprise Brand and Content Support |

## UI

Admin UI: `/settings/firm-brain/case-studies`

Features:
- List view with search
- Filter tabs: All / Public / Internal
- Permission badges (🌐 Public / 🔒 Internal)
- Services and tags chips
- Full CRUD operations

## Legacy Compatibility

The schema normalizes legacy permission values:

| Legacy Value | Normalized To |
|--------------|---------------|
| `internal_only` | `internal` |
| `nda_allowed` | `internal` |
| `public` | `public` |

## Testing

```bash
npm run test -- tests/os/caseStudies.test.ts
```

Tests cover:
- Schema validation (minimal, full, invalid)
- Metrics format (array vs object)
- Permission normalization
- Seed data structure
- Filtering logic
