
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const mysql = require('mysql2');

const app = express();
const port = 3030;

app.use(express.json()); // Add this line to parse JSON data in the request body

// Log the environment variables to verify their values
console.log('MYSQL_HOST:', process.env.MYSQL_HOST);
console.log('MYSQL_USER:', process.env.MYSQL_USER);
console.log('MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD);
console.log('MYSQL_NAME:', process.env.MYSQL_DBNAME);
console.log('MYSQL_PORT:', process.env.MYSQL_PORT);

// Create a MySQL connection
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DBNAME,
    port: process.env.MYSQL_PORT
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Middleware to handle --location from cURL request
app.use((req, res, next) => {
    if (req.query.location === 'true') {
        req.location = true;
    } else {
        req.location = false;
    }
    next();
});

// Define a route handler for "/activity-groups"
app.get('/activity-groups', (req, res) => {
    // Query the database to fetch the desired data
    const query = 'SELECT activity_id, title, email, created_at FROM activities';
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error querying the database:', error);
            // Handle the error and send an appropriate response
            res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        } else {
            if (!results || results.length === 0) {
                // Handle the case when no data is found
                res.status(404).json({
                    status: 'Not Found',
                    message: 'No data found',
                });
            } else {
                // Map the results to create an array of responses
                const responseArray = results.map((dataFromDatabase) => ({
                    id: dataFromDatabase.activity_id,
                    title: dataFromDatabase.title,
                    email: dataFromDatabase.email,
                    createdAt: dataFromDatabase.created_at,
                    updatedAt: dataFromDatabase.created_at,
                }));

                // Create the final response object
                const response = {
                    status: 'Success',
                    message: 'Success',
                    data: responseArray,
                };

                if (req.location) {
                    // If the --location flag is true, include location data
                    response.location = 'Some location data here';
                }

                res.json(response);
            }
        }
    });
});

// Define a route handler to get a specific activity group by ID
app.get('/activity-groups/:id', (req, res) => {
    const id = req.params.id;
    const query = 'SELECT activity_id, title, email, created_at FROM activities WHERE activity_id = ?';

    db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Error querying the database:', error);
            res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        } else {
            if (!results || results.length === 0) {
                res.status(404).json({
                    status: 'Not Found',
                    message: 'No data found',
                });
            } else {
                const activity = results[0];
                const response = {
                    status: 'Success',
                    message: 'Success',
                    data: {
                        id: activity.activity_id,
                        title: activity.title,
                        email: activity.email,
                        createdAt: activity.created_at,
                        updatedAt: activity.created_at,
                    },
                };
                res.json(response);
            }
        }
    });
});
// Define a route handler to post new entry
app.post('/activity-groups', (req, res) => {
    try {
        // Ensure that the request has the 'Content-Type' header set to 'application/json'
        if (req.get('Content-Type') !== 'application/json') {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid content type. Please send JSON data.',
            });
        }

        // Destructure 'title' and 'email' from the request body
        const { title, email } = req.body;

        if (!title || !email) {
            return res.status(400).json({
                status: 'Error',
                message: 'Missing required fields: title and/or email.',
            });
        }

        // Generate the current datetime
        const currentDatetime = new Date().toISOString();
        const query = 'INSERT INTO activities (title, email, created_at) VALUES (?, ?, ?)';

        db.query(query, [title, email, currentDatetime], (error, result) => {
            if (error) {
                console.error('Error inserting data into the database:', error);
                return res.status(500).json({
                    status: 'Error',
                    message: 'Internal Server Error',
                });
            }

            const response = {
                status: 'Success',
                message: 'Activity group added successfully',
                data: {
                    id: result.activity_id, // Get the auto-generated ID of the inserted record
                    title,
                    email,
                    createdAt: currentDatetime, // Include the created_at timestamp
                    updatedAt: currentDatetime, // Assume updated_at is the same as created_at
                },
            };
            return res.status(201).json(response); // Use status 201 (Created) for successful creation
        });
    } catch (error) {
        console.error('Error processing the request:', error);
        return res.status(500).json({
            status: 'Error',
            message: 'Internal Server Error',
        });
    }
});

// Define a route handler to update an activity group by ID
app.patch('/activity-groups/:id', (req, res) => {
    const id = req.params.id;
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({
            status: 'Error',
            message: 'Missing required field: title.',
        });
    }

    // Retrieve the existing created_at value
    const getCreatedAtQuery = 'SELECT email, created_at FROM activities WHERE activity_id = ?';
    db.query(getCreatedAtQuery, [id], (error, result) => {
        if (error) {
            console.error('Error fetching created_at from the database:', error);
            return res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                status: 'Error',
                message: 'Activity group not found.',
            });
        }

        // Store the existing created_at value
        const existingCreatedAt = result[0].created_at;
        const existingEmail = result[0].email;
        const currentDatetime = new Date().toISOString();

        // Update the activity group in the database
        const updateQuery = 'UPDATE activities SET title = ? WHERE activity_id = ?';
        db.query(updateQuery, [title, id], (error, updateResult) => {
            if (error) {
                console.error('Error updating data in the database:', error);
                return res.status(500).json({
                    status: 'Error',
                    message: 'Internal Server Error',
                });
            }

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    status: 'Error',
                    message: 'Activity group not found.',
                });
            }

            const response = {
                status: 'Success',
                message: 'Success',
                data: {
                    id,
                    title,
                    email: existingEmail,
                    created_at: existingCreatedAt, // Include the existing created_at timestamp
                    updated_at: existingCreatedAt,
                },
            };
            res.json(response);
        });
    });
});


// Define a route handler to delete an activity group by ID
app.delete('/activity-groups/:id', (req, res) => {
    const id = req.params.id;

    // Delete the activity group in the database
    const query = 'DELETE FROM activities WHERE activity_id = ?';
    db.query(query, [id], (error, result) => {
        if (error) {
            console.error('Error deleting data from the database:', error);
            return res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'Not Found',
                message: 'Activity with ID '+ id +' Not Found',
            });
        }

        const response = {
            status: 'Success',
            message: 'Activity with ID ' + id +' Deleted',
            data: {
                id,
            },
        };
        res.json(response);
    });
});

// START OF TODO HANDLER
// Define a route handler for "/todo-items"
app.get('/todo-items', (req, res) => {
    // Query the database to fetch the desired data
    const query = 'SELECT todo_id, activity_group_id, title, is_active, priority, created_at FROM todos';
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error querying the database:', error);
            // Handle the error and send an appropriate response
            res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        } else {
            if (!results || results.length === 0) {
                // Handle the case when no data is found
                res.status(404).json({
                    status: 'Not Found',
                    message: 'No data found',
                });
            } else {
                // Map the results to create an array of responses
                const responseArray = results.map((dataFromDatabase) => ({
                    id: dataFromDatabase.activity_id,
                    activity_group_id: dataFromDatabase.activity_group_id,
                    title: dataFromDatabase.title,
                    is_active: dataFromDatabase.is_active,
                    priority: dataFromDatabase.priority,
                    createdAt: dataFromDatabase.created_at,
                    updatedAt: dataFromDatabase.created_at,
                }));

                // Create the final response object
                const response = {
                    status: 'Success',
                    message: 'Success',
                    data: responseArray,
                };

                if (req.location) {
                    // If the --location flag is true, include location data
                    response.location = 'Some location data here';
                }

                res.json(response);
            }
        }
    });
});

// Define a route handler to get a specific activity group by ID
app.get('/todo-items/:id', (req, res) => {
    const id = req.params.id;
    const query = 'SELECT todo_id, activity_group_id, title, is_active, created_at FROM todos WHERE todo_id = ?';

    db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Error querying the database:', error);
            res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        } else {
            if (!results || results.length === 0) {
                res.status(404).json({
                    status: 'Not Found',
                    message: 'No data found',
                });
            } else {
                const activity = results[0];
                const response = {
                    status: 'Success',
                    message: 'Success',
                    data: {
                        id: activity.activity_id,
                        activity_group_id: activity.activity_group_id,
                        title: activity.title,
                        is_active: activity.is_active,
                        priority: activity.priority,
                        createdAt: activity.created_at,
                        updatedAt: activity.created_at,
                    },
                };
                res.json(response);
            }
        }
    });
});
// Define a route handler to post new entry
app.post('/todo-items', (req, res) => {
    try {
        // Ensure that the request has the 'Content-Type' header set to 'application/json'
        if (req.get('Content-Type') !== 'application/json') {
            return res.status(400).json({
                status: 'Error',
                message: 'Invalid content type. Please send JSON data.',
            });
        }

        // Destructure 'title', 'is_active', 'activity_group_id' from the request body
        const { title, activity_group_id, is_active } = req.body;

        if (!title || !is_active || !activity_group_id) {
            return res.status(400).json({
                status: 'Error',
                message: 'Missing required fields: title or is_active or activity_group_id.',
            });
        }

        // Generate the current datetime
        const currentDatetime = new Date().toISOString();
        const priorityParam = "very-high";
        const query = 'INSERT INTO todos (activity_group_id, title, is_active, priority, created_at) VALUES (?, ?, ?, ?, ?)';

        db.query(query, [activity_group_id, title, is_active, priorityParam, currentDatetime], (error, result) => {
            if (error) {
                console.error('Error inserting data into the database:', error);
                return res.status(500).json({
                    status: 'Error',
                    message: 'Internal Server Error',
                });
            }

            const response = {
                status: 'Success',
                message: 'Activity group added successfully',
                data: {
                    id: result.todo_id, // Get the auto-generated ID of the inserted record
                    activity_group_id,
                    title,
                    is_active,
                    priorityParam,
                    createdAt: currentDatetime, // Include the created_at timestamp
                    updatedAt: currentDatetime, // Assume updated_at is the same as created_at
                },
            };
            return res.status(201).json(response); // Use status 201 (Created) for successful creation
        });
    } catch (error) {
        console.error('Error processing the request:', error);
        return res.status(500).json({
            status: 'Error',
            message: 'Internal Server Error',
        });
    }
});

// Define a route handler to update a todo item by ID
app.patch('/todo-items/:id', (req, res) => {
    const id = req.params.id;
    const { title, priority, is_active, status } = req.body;
    const updatedAt = new Date().toISOString();

    if (!title || !priority || !is_active || !status) {
        return res.status(400).json({
            status: 'Error',
            message: 'Missing required field: title, priority, is_active, status.',
        });
    }

    // Retrieve the existing created_at value
    const getCreatedAtQuery = 'SELECT created_at FROM todos WHERE todo_id = ?';
    db.query(getCreatedAtQuery, [id], (error, result) => {
        if (error) {
            console.error('Error fetching created_at from the database:', error);
            return res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                status: 'Error',
                message: 'Todo item not found.',
            });
        }

        // Store the existing created_at value
        const existingCreatedAt = result[0].created_at;

        // Update the todo item in the database
        const updateQuery = 'UPDATE todos SET title = ?, priority = ?, is_active = ?, created_at = ? WHERE todo_id = ?';
        db.query(updateQuery, [title, priority, is_active, existingCreatedAt, id], (error, updateResult) => {
            if (error) {
                console.error('Error updating data in the database:', error);
                return res.status(500).json({
                    status: 'Error',
                    message: 'Internal Server Error',
                });
            }

            if (updateResult.affectedRows === 0) {
                return res.status(404).json({
                    status: 'Error',
                    message: 'Todo item not found.2',
                });
            }

            const response = {
                status: 'Success',
                message: 'Success',
                data: {
                    id,
                    title,
                    priority,
                    is_active,
                    status,
                    createdAt: existingCreatedAt, // Include the existing created_at timestamp
                    updatedAt
                },
            };
            res.json(response);
        });
    });
});

// Define a route handler to delete an activity group by ID
app.delete('/todo-items/:id', (req, res) => {
    const id = req.params.id;

    // Delete the activity group in the database
    const query = 'DELETE FROM todos WHERE todo_id = ?';
    db.query(query, [id], (error, result) => {
        if (error) {
            console.error('Error deleting data from the database:', error);
            return res.status(500).json({
                status: 'Error',
                message: 'Internal Server Error',
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: 'Not Found',
                message: 'Activity with ID ' + id + ' Not Found',
            });
        }

        const response = {
            status: 'Success',
            message: 'Activity with ID ' + id + ' Deleted',
            data: {
                id,
            },
        };
        res.json(response);
    });
});





app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});