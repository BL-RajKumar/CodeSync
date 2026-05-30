import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CodeSync API',
      version: '1.0.0',
      description: 'API documentation for the CodeSync collaborative code editor backend',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
      {
        url: 'https://codesync-092c.onrender.com',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid', // Default express-session cookie name
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  // Look for swagger documentation in these files
  apis: ['./docs/*.yaml', './models/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Swagger Page
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CodeSync API Documentation",
  }));

  // Docs in JSON format
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default setupSwagger;
