/**
 * Tickets Controller
 * HTTP handlers for kanban tickets API
 */
const ticketsRepo = require('./tickets.repo');

/**
 * Create a new ticket
 * POST /tickets
 */
const createTicket = async (req, res) => {
    try {
        const { workspaceKey } = req;
        const userKey = req.user?.UserKey || req.user?.key;
        const { title, description, type, priority, assigneeUserKey, dueDate, conversationKey } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const ticket = await ticketsRepo.createTicket({
            workspaceKey,
            conversationKey,
            title: title.trim(),
            description,
            type: type || 1,
            priority: priority || 2,
            assigneeUserKey,
            reporterUserKey: userKey,
            dueDate
        });

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ message: 'Failed to create ticket' });
    }
};

/**
 * Get tickets for current workspace
 * GET /tickets
 */
const getTickets = async (req, res) => {
    try {
        const { workspaceKey } = req;
        const { status, type, assignee, priority } = req.query;

        const tickets = await ticketsRepo.getTicketsByWorkspace(workspaceKey, {
            status: status ? parseInt(status) : null,
            type: type ? parseInt(type) : null,
            assigneeUserKey: assignee ? parseInt(assignee) : null,
            priority: priority ? parseInt(priority) : null
        });

        res.json({ tickets });
    } catch (error) {
        console.error('Error getting tickets:', error);
        res.status(500).json({ message: 'Failed to get tickets' });
    }
};

/**
 * Get ticket by ID
 * GET /tickets/:id
 */
const getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await ticketsRepo.getTicketById(id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Error getting ticket:', error);
        res.status(500).json({ message: 'Failed to get ticket' });
    }
};

/**
 * Update ticket
 * PUT /tickets/:id
 */
const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority, assigneeUserKey, dueDate } = req.body;

        const ticket = await ticketsRepo.getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        await ticketsRepo.updateTicket(ticket.TicketKey, {
            title: title || ticket.Title,
            description: description !== undefined ? description : ticket.Description,
            priority: priority || ticket.Priority,
            assigneeUserKey,
            dueDate
        });

        const updated = await ticketsRepo.getTicketById(id);
        res.json(updated);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ message: 'Failed to update ticket' });
    }
};

/**
 * Update ticket status (for drag-drop)
 * PATCH /tickets/:id/status
 */
const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, position } = req.body;

        if (!status || status < 1 || status > 4) {
            return res.status(400).json({ message: 'Invalid status (1-4)' });
        }

        const ticket = await ticketsRepo.getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        await ticketsRepo.updateTicketStatus(ticket.TicketKey, status, position || 0);

        res.json({ success: true, status, position });
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ message: 'Failed to update status' });
    }
};

/**
 * Delete ticket
 * DELETE /tickets/:id
 */
const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;

        const ticket = await ticketsRepo.getTicketById(id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        await ticketsRepo.deleteTicket(ticket.TicketKey);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ message: 'Failed to delete ticket' });
    }
};

/**
 * Get ticket stats for workspace
 * GET /tickets/stats
 */
const getTicketStats = async (req, res) => {
    try {
        const { workspaceKey } = req;
        const counts = await ticketsRepo.getTicketCountsByStatus(workspaceKey);

        // Format as object
        const stats = { new: 0, inProgress: 0, waiting: 0, done: 0 };
        counts.forEach(c => {
            if (c.Status === 1) stats.new = c.Count;
            if (c.Status === 2) stats.inProgress = c.Count;
            if (c.Status === 3) stats.waiting = c.Count;
            if (c.Status === 4) stats.done = c.Count;
        });

        res.json(stats);
    } catch (error) {
        console.error('Error getting ticket stats:', error);
        res.status(500).json({ message: 'Failed to get stats' });
    }
};

// Admin endpoints
/**
 * Get all tickets (admin)
 * GET /admin/tickets
 */
const adminGetAllTickets = async (req, res) => {
    try {
        const { workspace, status, type, limit, offset } = req.query;

        const tickets = await ticketsRepo.getAllTicketsForAdmin({
            workspaceKey: workspace ? parseInt(workspace) : null,
            status: status ? parseInt(status) : null,
            type: type ? parseInt(type) : null,
            limit: limit ? parseInt(limit) : 100,
            offset: offset ? parseInt(offset) : 0
        });

        res.json({ tickets });
    } catch (error) {
        console.error('Error getting admin tickets:', error);
        res.status(500).json({ message: 'Failed to get tickets' });
    }
};

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    updateTicketStatus,
    deleteTicket,
    getTicketStats,
    adminGetAllTickets
};
