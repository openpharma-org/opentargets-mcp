# Unofficial Open Targets MCP Server

Model Context Protocol server for accessing Open Targets platform data for gene-drug-disease associations research.

## Usage

```json
{
  "mcpServers": {
    "opentargets-server": {
      "command": "node",
      "args": ["/path/to/opentargets-mcp-server/build/index.js"]
    }
  }
}
```

## Tool: `opentargets_info`

Single unified tool with 6 methods via the `method` parameter:

### `search_targets`
Search genes by symbol, name, or description.
```json
{ "method": "search_targets", "query": "BRCA1", "size": 10 }
```

### `search_diseases`
Search diseases by name or synonym.
```json
{ "method": "search_diseases", "query": "breast cancer", "size": 10 }
```

### `get_target_disease_associations`
Get associations with evidence scores. Provide either `targetId` or `diseaseId`.
```json
{ "method": "get_target_disease_associations", "targetId": "ENSG00000012048", "size": 10 }
```
```json
{ "method": "get_target_disease_associations", "diseaseId": "EFO_0000305", "size": 10 }
```

### `get_disease_targets_summary`
Get prioritized therapeutic targets for a disease.
```json
{ "method": "get_disease_targets_summary", "diseaseId": "EFO_0000305", "size": 20 }
```

### `get_target_details`
Comprehensive gene/protein information.
```json
{ "method": "get_target_details", "id": "ENSG00000012048" }
```

### `get_disease_details`
Comprehensive disease information.
```json
{ "method": "get_disease_details", "id": "EFO_0000305" }
```

## Identifiers

- **Targets**: Ensembl gene IDs (e.g., `ENSG00000012048` for BRCA1)
- **Diseases**: EFO IDs (e.g., `EFO_0000305` for breast cancer)
- **Drugs**: ChEMBL IDs (e.g., `CHEMBL1234`)

## API

- **Endpoint**: `https://api.platform.opentargets.org/api/v4/graphql`
- **Version**: Open Targets v25.0.1
- **Authentication**: None required
