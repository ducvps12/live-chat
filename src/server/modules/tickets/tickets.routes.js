/**
 * Tickets Routes
 * Express router for kanban tickets API
 */
const express = require('express');
const router = express.Router();
const ticketsController = require('./tickets.controller');
const authenticate = require('../../middlewares/authenticate');
const resolveWorkspace = require('../../middlewares/resolveWorkspace');

// All routes require authentication and workspace context
router.use(authenticate);
router.use(resolveWorkspace);

// Ticket CRUD
router.post('/', ticketsController.createTicket);
router.get('/', ticketsController.getTickets);
router.get('/stats', ticketsController.getTicketStats);
router.get('/:id', ticketsController.getTicketById);
router.put('/:id', ticketsController.updateTicket);
router.patch('/:id/status', ticketsController.updateTicketStatus);
router.delete('/:id', ticketsController.deleteTicket);

module.exports = router;

