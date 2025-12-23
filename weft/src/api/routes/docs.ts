import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Creates the documentation router for Swagger UI and OpenAPI spec
 */
export function createDocsRouter(): Router {
  const router = Router();

  // Load OpenAPI spec from YAML file
  const openApiPath = join(__dirname, '..', 'openapi.yaml');
  const openApiYaml = readFileSync(openApiPath, 'utf8');
  const openApiSpec = load(openApiYaml) as Record<string, unknown>;

  // Serve OpenAPI spec as JSON
  router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // Configure Swagger UI options
  const swaggerUiOptions = {
    customSiteTitle: 'Weft API Documentation',
    explorer: true,
    swaggerOptions: {
      deepLinking: true,
      displayOperationId: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
    },
  };

  // Serve Swagger UI
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, swaggerUiOptions)
  );

  return router;
}
