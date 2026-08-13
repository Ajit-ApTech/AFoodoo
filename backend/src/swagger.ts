import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AFoodoo Tiffin Booking API',
      version: '1.0.0',
      description: 'Production-ready REST API for AFoodoo Tiffin Meal Booking Platform.',
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        MealSlot: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Lunch' },
            booking_open_time: { type: 'string', format: 'date-time' },
            booking_cutoff_time: { type: 'string', format: 'date-time' },
            delivery_start_time: { type: 'string', format: 'date-time' },
            delivery_end_time: { type: 'string', format: 'date-time' },
            active: { type: 'boolean', example: true },
          },
        },
        MenuItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            meal_slot_id: { type: 'string' },
            title: { type: 'string', example: 'Special Butter Chicken Meal Box' },
            description: { type: 'string' },
            price: { type: 'number', example: 12.99 },
            veg_flag: { type: 'boolean', example: false },
            is_available: { type: 'boolean', example: true },
            max_quantity: { type: 'integer', example: 50 },
            quantity_booked: { type: 'integer', example: 12 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            menu_item_id: { type: 'string' },
            meal_slot_id: { type: 'string' },
            status: { type: 'string', enum: ['booked', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'] },
            payment_status: { type: 'string', enum: ['pending', 'paid', 'failed'] },
            delivery_address: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            plan_type: { type: 'string', example: 'Monthly Lunch Pack' },
            meals_remaining: { type: 'integer', example: 20 },
            start_date: { type: 'string', format: 'date-time' },
            end_date: { type: 'string', format: 'date-time' },
            auto_renew: { type: 'boolean', example: true },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health Check',
          responses: {
            '200': { description: 'Server operational status' },
          },
        },
      },
      '/metrics': {
        get: {
          summary: 'Basic Server Metrics',
          responses: {
            '200': { description: 'Uptime and request metrics' },
          },
        },
      },
      '/api/orders': {
        post: {
          summary: 'Place a new tiffin meal order with strict cutoff time validation',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user_id', 'menu_item_id', 'meal_slot_id', 'delivery_address'],
                  properties: {
                    user_id: { type: 'string' },
                    menu_item_id: { type: 'string' },
                    meal_slot_id: { type: 'string' },
                    delivery_address: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Order created successfully' },
            '400': { description: 'Cutoff passed or validation error' },
          },
        },
      },
      '/api/orders/{id}/pay': {
        post: {
          summary: 'Update order payment status',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['payment_status'],
                  properties: {
                    payment_status: { type: 'string', enum: ['paid', 'pending', 'failed'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Payment status updated' },
          },
        },
      },
      '/api/subscriptions': {
        get: {
          summary: 'Get user subscriptions',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'userId', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'List of subscriptions' },
          },
        },
        post: {
          summary: 'Create subscription',
          security: [{ BearerAuth: [] }],
          responses: {
            '201': { description: 'Subscription created' },
          },
        },
      },
      '/api/subscriptions/{id}/pause': {
        patch: {
          summary: 'Pause/skip meal for a specific date',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['skip_date'],
                  properties: {
                    skip_date: { type: 'string', example: '2026-08-15' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Meal paused successfully' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
