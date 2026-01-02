package handlers

import (
	"fmt"
	"log"
	"starter/backend/database"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// SSEClient represents a connected SSE client
type SSEClient struct {
	ID       string
	UserID   uint
	RoomIDs  []uint // Rooms the user is assigned to
	IsAdmin  bool   // Admin receives all notifications
	Channel  chan SSEMessage
	LastPing time.Time
}

// SSEMessage represents a message to be sent via SSE
type SSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// SSEHub manages all SSE connections
type SSEHub struct {
	clients    map[string]*SSEClient
	register   chan *SSEClient
	unregister chan string
	broadcast  chan SSEBroadcast
	mutex      sync.RWMutex
}

// SSEBroadcast for targeted broadcasting
type SSEBroadcast struct {
	UserIDs []uint // Send to specific users (empty = all)
	RoomIDs []uint // Send to users assigned to these rooms
	Message SSEMessage
}

// Global SSE Hub
var Hub *SSEHub

// InitSSEHub initializes the global SSE hub
func InitSSEHub() {
	Hub = &SSEHub{
		clients:    make(map[string]*SSEClient),
		register:   make(chan *SSEClient),
		unregister: make(chan string),
		broadcast:  make(chan SSEBroadcast, 100),
	}
	go Hub.run()
	go Hub.pingClients()
}

// run starts the hub's main loop
func (h *SSEHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client.ID] = client
			h.mutex.Unlock()
			log.Printf("SSE client connected: %s (user: %d, isAdmin: %v, rooms: %v)", client.ID, client.UserID, client.IsAdmin, client.RoomIDs)

		case clientID := <-h.unregister:
			h.mutex.Lock()
			if client, ok := h.clients[clientID]; ok {
				close(client.Channel)
				delete(h.clients, clientID)
				log.Printf("SSE client disconnected: %s", clientID)
			}
			h.mutex.Unlock()

		case broadcast := <-h.broadcast:
			h.mutex.RLock()
			log.Printf("[SSE Hub] Broadcasting event, UserIDs=%v, RoomIDs=%v, Connected clients=%d", broadcast.UserIDs, broadcast.RoomIDs, len(h.clients))
			for _, client := range h.clients {
				shouldSend := false

				if len(broadcast.UserIDs) == 0 && len(broadcast.RoomIDs) == 0 {
					// Broadcast to all (including admin)
					shouldSend = true
				} else {
					// Check user IDs (admin is already included in userIDs from NotifyRoomUsers/NotifyUsers)
					for _, userID := range broadcast.UserIDs {
						if client.UserID == userID {
							shouldSend = true
							break
						}
					}

					// Check room IDs
					if !shouldSend && len(broadcast.RoomIDs) > 0 {
						for _, roomID := range broadcast.RoomIDs {
							for _, clientRoomID := range client.RoomIDs {
								if roomID == clientRoomID {
									shouldSend = true
									break
								}
							}
							if shouldSend {
								break
							}
						}
					}
				}

				if shouldSend {
					select {
					case client.Channel <- broadcast.Message:
						log.Printf("[SSE Hub] Message sent to client %s (user %d)", client.ID, client.UserID)
					default:
						log.Printf("[SSE Hub] Channel full for client %s, skipped", client.ID)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// pingClients sends periodic pings to keep connections alive
func (h *SSEHub) pingClients() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		h.mutex.RLock()
		for _, client := range h.clients {
			select {
			case client.Channel <- SSEMessage{Event: "ping", Data: time.Now().Unix()}:
			default:
			}
		}
		h.mutex.RUnlock()
	}
}

// SendToUser sends a message to a specific user
func (h *SSEHub) SendToUser(userID uint, event string, data interface{}) {
	h.broadcast <- SSEBroadcast{
		UserIDs: []uint{userID},
		Message: SSEMessage{Event: event, Data: data},
	}
}

// SendToUsers sends a message to specific users
func (h *SSEHub) SendToUsers(userIDs []uint, event string, data interface{}) {
	h.broadcast <- SSEBroadcast{
		UserIDs: userIDs,
		Message: SSEMessage{Event: event, Data: data},
	}
}

// SendToRooms sends a message to users assigned to specific rooms
func (h *SSEHub) SendToRooms(roomIDs []uint, event string, data interface{}) {
	h.broadcast <- SSEBroadcast{
		RoomIDs: roomIDs,
		Message: SSEMessage{Event: event, Data: data},
	}
}

// SendToAll broadcasts a message to all connected clients
func (h *SSEHub) SendToAll(event string, data interface{}) {
	h.broadcast <- SSEBroadcast{
		Message: SSEMessage{Event: event, Data: data},
	}
}

// GetConnectedUsers returns the count of connected users
func (h *SSEHub) GetConnectedUsers() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// SSEHandler handles SSE connections
func SSEHandler(c *gin.Context) {
	// Get user from context (middleware sets "userID")
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDInterface.(uint)

	// Get user's assigned rooms from user_room_assignments
	var roomIDs []uint
	database.DB.Table("user_room_assignments").
		Where("user_id = ? AND is_active = ? AND deleted_at IS NULL", userID, true).
		Pluck("room_id", &roomIDs)

	// Also get rooms from room_staff (via employee)
	var staffRoomIDs []uint
	database.DB.Table("room_staff").
		Joins("JOIN users ON users.employee_id = room_staff.employee_id").
		Where("users.id = ? AND room_staff.deleted_at IS NULL", userID).
		Pluck("room_staff.room_id", &staffRoomIDs)

	// Merge room IDs
	for _, rid := range staffRoomIDs {
		found := false
		for _, existing := range roomIDs {
			if existing == rid {
				found = true
				break
			}
		}
		if !found {
			roomIDs = append(roomIDs, rid)
		}
	}

	// Check if user is admin (Super Admin, Admin, or admin role)
	var isAdmin bool
	var adminCount int64
	database.DB.Table("users").
		Joins("JOIN roles ON users.role_id = roles.id").
		Where("users.id = ? AND (roles.name = ? OR roles.name = ? OR roles.name = ?)", userID, "Super Admin", "admin", "Admin").
		Count(&adminCount)
	isAdmin = adminCount > 0

	// Create client
	clientID := fmt.Sprintf("%d-%d", userID, time.Now().UnixNano())
	client := &SSEClient{
		ID:       clientID,
		UserID:   userID,
		RoomIDs:  roomIDs,
		IsAdmin:  isAdmin,
		Channel:  make(chan SSEMessage, 10),
		LastPing: time.Now(),
	}

	// Register client
	Hub.register <- client
	log.Printf("[SSE Handler] Client registered: %s (user: %d, isAdmin: %v, roomIDs: %v)", clientID, userID, isAdmin, roomIDs)

	// Set headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("X-Accel-Buffering", "no")

	// Send initial connection message
	c.SSEvent("connected", gin.H{
		"client_id": clientID,
		"user_id":   userID,
		"room_ids":  roomIDs,
		"is_admin":  isAdmin,
	})
	c.Writer.Flush()

	// Create done channel to handle cleanup
	done := c.Request.Context().Done()

	// Stream messages - this blocks and keeps connection open
	for {
		select {
		case <-done:
			// Client disconnected
			Hub.unregister <- clientID
			log.Printf("[SSE Handler] Client disconnected: %s", clientID)
			return
		case msg, ok := <-client.Channel:
			if !ok {
				// Channel closed
				return
			}
			// Gin's SSEvent already handles JSON marshaling, don't double-encode
			c.SSEvent(msg.Event, msg.Data)
			c.Writer.Flush()
			log.Printf("[SSE Handler] Sent event '%s' to client %s", msg.Event, clientID)
		}
	}
}
