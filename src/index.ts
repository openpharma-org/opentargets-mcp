#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// Type definitions
type OpenTargetsMethod =
  | 'search_targets'
  | 'search_diseases'
  | 'get_target_disease_associations'
  | 'get_disease_targets_summary'
  | 'get_target_details'
  | 'get_disease_details';

// Type guards and validation functions
const isValidMethod = (method: any): method is OpenTargetsMethod => {
  return typeof method === 'string' && [
    'search_targets',
    'search_diseases',
    'get_target_disease_associations',
    'get_disease_targets_summary',
    'get_target_details',
    'get_disease_details'
  ].includes(method);
};

const isValidTargetSearchArgs = (args: any): args is { query: string; size?: number; format?: string } => {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof args.query === 'string' &&
    args.query.length > 0 &&
    (args.size === undefined || (typeof args.size === 'number' && args.size > 0 && args.size <= 50000)) &&
    (args.format === undefined || ['json', 'tsv'].includes(args.format))
  );
};

const isValidDiseaseSearchArgs = (args: any): args is { query: string; size?: number; format?: string } => {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof args.query === 'string' &&
    args.query.length > 0 &&
    (args.size === undefined || (typeof args.size === 'number' && args.size > 0 && args.size <= 50000)) &&
    (args.format === undefined || ['json', 'tsv'].includes(args.format))
  );
};

const isValidAssociationArgs = (args: any): args is { targetId?: string; diseaseId?: string; minScore?: number; size?: number } => {
  return (
    typeof args === 'object' &&
    args !== null &&
    (args.targetId === undefined || typeof args.targetId === 'string') &&
    (args.diseaseId === undefined || typeof args.diseaseId === 'string') &&
    (args.minScore === undefined || (typeof args.minScore === 'number' && args.minScore >= 0 && args.minScore <= 1)) &&
    (args.size === undefined || (typeof args.size === 'number' && args.size > 0 && args.size <= 50000)) &&
    (args.targetId !== undefined || args.diseaseId !== undefined)
  );
};

const isValidIdArgs = (args: any): args is { id: string } => {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof args.id === 'string' &&
    args.id.length > 0
  );
};

class OpenTargetsServer {
  private server: McpServer;
  private graphqlClient: AxiosInstance;

  constructor() {
    this.server = new McpServer(
      {
        name: 'opentargets-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Initialize Open Targets GraphQL API client
    this.graphqlClient = axios.create({
      baseURL: 'https://api.platform.opentargets.org/api/v4/graphql',
      timeout: 30000,
      headers: {
        'User-Agent': 'OpenTargets-MCP-Server/0.1.0',
        'Content-Type': 'application/json',
      },
    });

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Error handling
    this.server.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // Resource templates are not directly supported in the same way with McpServer
    // We'll use registerResource with ResourceTemplate for dynamic resources
    // For now, keeping the basic structure - can be expanded later
  }

  private setupToolHandlers() {
    this.server.registerTool(
      'opentargets_info',
      {
        description: 'Unified tool for Open Targets operations: search targets and diseases, retrieve associations, and get detailed information. Access gene-drug-disease associations from Open Targets platform (v25.0.1). Use the method parameter to specify the operation type.',
        inputSchema: z.object({
          method: z.enum([
            'search_targets',
            'search_diseases',
            'get_target_disease_associations',
            'get_disease_targets_summary',
            'get_target_details',
            'get_disease_details'
          ]).describe('The operation to perform: search_targets (search for therapeutic targets by gene symbol/name), search_diseases (search for diseases by name/synonym), get_target_disease_associations (get target-disease associations with evidence scores), get_disease_targets_summary (get overview of all targets associated with a disease), get_target_details (get comprehensive target information), or get_disease_details (get comprehensive disease information)'),
          query: z.string().optional().describe('For search_targets and search_diseases: Search query (gene symbol, name, description for targets; disease name, synonym, description for diseases)'),
          targetId: z.string().optional().describe('For get_target_disease_associations: Target Ensembl gene ID (e.g., ENSG00000012048)'),
          diseaseId: z.string().optional().describe('For get_target_disease_associations and get_disease_targets_summary: Disease EFO ID (e.g., EFO_0000305)'),
          minScore: z.number().min(0).max(1).optional().describe('For get_target_disease_associations and get_disease_targets_summary: Minimum association score (0-1)'),
          id: z.string().optional().describe('For get_target_details and get_disease_details: Target Ensembl gene ID or Disease EFO ID'),
          size: z.number().min(1).max(500).optional().describe('Number of results to return (1-500, default: 25 for searches, 50 for disease targets summary)'),
          format: z.enum(['json', 'tsv']).optional().describe('Output format (default: json)'),
        }),
      },
      async (args) => {
        const method = args.method;
        if (!method || !isValidMethod(method)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'method parameter is required and must be one of: search_targets, search_diseases, get_target_disease_associations, get_disease_targets_summary, get_target_details, get_disease_details',
              },
            ],
            isError: true,
          };
        }

        switch (method) {
          case 'search_targets':
            return this.handleSearchTargets(args);
          case 'search_diseases':
            return this.handleSearchDiseases(args);
          case 'get_target_disease_associations':
            return this.handleGetTargetDiseaseAssociations(args);
          case 'get_disease_targets_summary':
            return this.handleGetDiseaseTargetsSummary(args);
          case 'get_target_details':
            return this.handleGetTargetDetails(args);
          case 'get_disease_details':
            return this.handleGetDiseaseDetails(args);
          default:
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Unknown method: ${method}`,
                },
              ],
              isError: true,
            };
        }
      }
    );
  }

  private async handleSearchTargets(args: any) {
    if (!isValidTargetSearchArgs(args)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Invalid target search arguments',
          },
        ],
        isError: true,
      };
    }

    try {
      const query = `
        query SearchTargets($queryString: String!) {
          search(queryString: $queryString, entityNames: ["target"]) {
            hits {
              id
              name
              description
              entity
            }
          }
        }
      `;

      const response = await this.graphqlClient.post('', {
        query,
        variables: {
          queryString: args.query
        }
      });

      // Limit results on client side
      const hits = response.data.data?.search?.hits || [];
      const limitedHits = hits.slice(0, args.size || 25);
      const result = {
        ...response.data,
        data: {
          search: {
            hits: limitedHits,
            total: hits.length
          }
        }
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error searching targets: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSearchDiseases(args: any) {
    if (!isValidDiseaseSearchArgs(args)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Invalid disease search arguments',
          },
        ],
        isError: true,
      };
    }

    try {
      const query = `
        query SearchDiseases($queryString: String!) {
          search(queryString: $queryString, entityNames: ["disease"]) {
            hits {
              id
              name
              description
              entity
            }
          }
        }
      `;

      const response = await this.graphqlClient.post('', {
        query,
        variables: {
          queryString: args.query
        }
      });

      // Limit results on client side
      const hits = response.data.data?.search?.hits || [];
      const limitedHits = hits.slice(0, args.size || 25);
      const result = {
        ...response.data,
        data: {
          search: {
            hits: limitedHits,
            total: hits.length
          }
        }
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error searching diseases: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetTargetDiseaseAssociations(args: any) {
    if (!isValidAssociationArgs(args)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Invalid association arguments',
          },
        ],
        isError: true,
      };
    }

    try {
      const requestedSize = args.size || 100;
      const minScore = args.minScore || 0;

      // If only targetId provided, get associations for that target
      if (args.targetId && !args.diseaseId) {
        const query = `query GetTargetAssociations($ensemblId: String!, $size: Int!, $offset: Int!) {
          target(ensemblId: $ensemblId) {
            id
            approvedSymbol
            associatedDiseases(page: {index: $offset, size: $size}) {
              count
              rows {
                disease {
                  id
                  name
                }
                score
              }
            }
          }
        }`;

        // Fetch all results with pagination
        let allRows: any[] = [];
        let pageIndex = 0;
        const pageSize = 100;
        let hasMore = true;
        let totalCount = 0;
        let targetId: string | undefined;
        let targetSymbol: string | undefined;

        while (hasMore) {
          const response = await this.graphqlClient.post('', {
            query,
            variables: {
              ensemblId: args.targetId,
              size: pageSize,
              offset: pageIndex
            }
          });

          const targetData = response.data.data?.target;
          const associations = targetData?.associatedDiseases;
          const rows = associations?.rows || [];

          if (pageIndex === 0) {
            totalCount = associations?.count || 0;
            targetId = targetData?.id;
            targetSymbol = targetData?.approvedSymbol;
          }

          allRows = allRows.concat(rows);
          pageIndex += 1;

          hasMore = rows.length === pageSize && allRows.length < totalCount && allRows.length < requestedSize;
        }

        // Filter by minScore if provided
        const filteredRows = minScore > 0
          ? allRows.filter((row: any) => row.score >= minScore)
          : allRows;

        // Limit to requested size
        const limitedRows = filteredRows.slice(0, requestedSize);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                data: {
                  target: {
                    id: targetId,
                    approvedSymbol: targetSymbol,
                    associatedDiseases: {
                      count: totalCount,
                      rows: limitedRows
                    }
                  }
                },
                pagination: {
                  requested: requestedSize,
                  returned: limitedRows.length,
                  total: totalCount,
                  filtered: filteredRows.length
                }
              }, null, 2),
            },
          ],
        };
      }

      // If only diseaseId provided, get associations for that disease
      else if (args.diseaseId && !args.targetId) {
        const query = `query GetDiseaseAssociations($efoId: String!, $size: Int!, $offset: Int!) {
          disease(efoId: $efoId) {
            id
            name
            associatedTargets(page: {index: $offset, size: $size}) {
              count
              rows {
                target {
                  id
                  approvedSymbol
                  approvedName
                }
                score
              }
            }
          }
        }`;

        // Fetch all results with pagination
        let allRows: any[] = [];
        let pageIndex = 0;
        const pageSize = 100;
        let hasMore = true;
        let totalCount = 0;
        let diseaseId: string | undefined;
        let diseaseName: string | undefined;

        while (hasMore) {
          const response = await this.graphqlClient.post('', {
            query,
            variables: {
              efoId: args.diseaseId,
              size: pageSize,
              offset: pageIndex
            }
          });

          const diseaseData = response.data.data?.disease;
          const associations = diseaseData?.associatedTargets;
          const rows = associations?.rows || [];

          if (pageIndex === 0) {
            totalCount = associations?.count || 0;
            diseaseId = diseaseData?.id;
            diseaseName = diseaseData?.name;
          }

          allRows = allRows.concat(rows);
          pageIndex += 1;

          hasMore = rows.length === pageSize && allRows.length < totalCount && allRows.length < requestedSize;
        }

        // Filter by minScore if provided
        const filteredRows = minScore > 0
          ? allRows.filter((row: any) => row.score >= minScore)
          : allRows;

        // Limit to requested size
        const limitedRows = filteredRows.slice(0, requestedSize);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                data: {
                  disease: {
                    id: diseaseId,
                    name: diseaseName,
                    associatedTargets: {
                      count: totalCount,
                      rows: limitedRows
                    }
                  }
                },
                pagination: {
                  requested: requestedSize,
                  returned: limitedRows.length,
                  total: totalCount,
                  filtered: filteredRows.length
                }
              }, null, 2),
            },
          ],
        };
      }

      // If both provided, return the association between them
      else {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                message: "Specific target-disease pair association lookup not yet implemented",
                suggestion: "Use targetId OR diseaseId to get associations for that entity"
              }, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting associations: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetDiseaseTargetsSummary(args: any) {
    if (!isValidIdArgs(args) && !args.diseaseId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Disease ID is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const diseaseId = args.diseaseId || args.id;
      const requestedSize = args.size || 50;
      const minScore = args.minScore || 0;

      // Updated query with pagination parameters
      const query = `query GetDiseaseTargetsSummary($efoId: String!, $size: Int!, $offset: Int!) {
        disease(efoId: $efoId) {
          id
          name
          associatedTargets(page: {index: $offset, size: $size}) {
            count
            rows {
              target {
                id
                approvedSymbol
                approvedName
              }
              score
            }
          }
        }
      }`;

      // Fetch all results with pagination
      let allRows: any[] = [];
      let pageIndex = 0;
      const pageSize = 100; // Fetch in batches of 100
      let hasMore = true;
      let totalCount = 0;
      let diseaseName: string | undefined;

      while (hasMore) {
        const response = await this.graphqlClient.post('', {
          query,
          variables: {
            efoId: diseaseId,
            size: pageSize,
            offset: pageIndex
          }
        });

        const diseaseData = response.data.data?.disease;
        const associations = diseaseData?.associatedTargets;
        const rows = associations?.rows || [];

        if (pageIndex === 0) {
          totalCount = associations?.count || 0;
          diseaseName = diseaseData?.name;
        }

        allRows = allRows.concat(rows);
        pageIndex += 1;

        // Stop if we've fetched all available data or reached requested size
        hasMore = rows.length === pageSize && allRows.length < totalCount && allRows.length < requestedSize;
      }

      // Filter by minScore if provided
      const filteredRows = minScore > 0
        ? allRows.filter((row: any) => row.score >= minScore)
        : allRows;

      // Limit to requested size
      const limitedRows = filteredRows.slice(0, requestedSize);

      const summary = {
        diseaseId,
        diseaseName: diseaseName || 'Unknown',
        totalTargets: totalCount,
        returnedTargets: limitedRows.length,
        targets: limitedRows.map((assoc: any) => ({
          targetId: assoc.target.id,
          targetSymbol: assoc.target.approvedSymbol,
          targetName: assoc.target.approvedName,
          associationScore: assoc.score,
        })),
        pagination: {
          requested: requestedSize,
          returned: limitedRows.length,
          total: totalCount,
          filtered: filteredRows.length
        }
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting disease targets summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetTargetDetails(args: any) {
    if (!isValidIdArgs(args)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Target ID is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const query = `query GetTarget($ensemblId: String!) {
        target(ensemblId: $ensemblId) {
          id
          approvedSymbol
          approvedName
          biotype
          functionDescriptions

          nameSynonyms { label source }
          symbolSynonyms { label source }

          genomicLocation {
            chromosome
            start
            end
            strand
          }

          proteinIds { id source }
          dbXrefs { id source }

          tractability { label modality value }
          targetClass { id label level }

          pathways { pathway pathwayId topLevelTerm }

          knownDrugs(size: 50) {
            uniqueDrugs
            count
            rows {
              prefName
              drugType
              drugId
              mechanismOfAction
              phase
              status
              disease { id name }
            }
          }

          associatedDiseases(page: {index: 0, size: 25}) {
            count
            rows {
              disease { id name }
              score
            }
          }
        }
      }`;

      const response = await this.graphqlClient.post('', {
        query,
        variables: {
          ensemblId: args.id
        }
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting target details: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetDiseaseDetails(args: any) {
    if (!isValidIdArgs(args)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Disease ID is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const query = `query GetDisease($efoId: String!) { disease(efoId: $efoId) { id name description } }`;

      const response = await this.graphqlClient.post('', {
        query,
        variables: {
          efoId: args.id
        }
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting disease details: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Open Targets MCP server running on stdio');
  }
}

const server = new OpenTargetsServer();
server.run().catch(console.error);
