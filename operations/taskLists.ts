/**
 * @fileoverview Task list operations for the MCP Kanban server
 *
 * In Planka v2 tasks live in task lists, and a card can have several of them.
 */

import { plankaRequest } from "../common/utils.js";

export interface TaskListOptions {
    name?: string;
    position?: number;
    showOnFrontOfCard?: boolean;
    hideCompletedTasks?: boolean;
}

/**
 * Retrieves all task lists of a card
 *
 * @param {string} cardId - The ID of the card
 * @returns {Promise<Array<object>>} Task lists of the card
 */
export async function getTaskLists(cardId: string) {
    const response: any = await plankaRequest(`/api/cards/${cardId}`);
    return response?.included?.taskLists ?? [];
}

/**
 * Retrieves a task list together with its tasks
 *
 * @param {string} id - The ID of the task list
 * @returns {Promise<object>} The task list and its tasks
 */
export async function getTaskList(id: string) {
    try {
        const response: any = await plankaRequest(`/api/task-lists/${id}`);
        return {
            ...response.item,
            tasks: response.included?.tasks ?? [],
        };
    } catch (error) {
        throw new Error(
            `Failed to get task list: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Creates a task list in a card
 *
 * @param {string} cardId - The ID of the card
 * @param {TaskListOptions} options - name and position are required
 * @returns {Promise<object>} The created task list
 */
export async function createTaskList(
    cardId: string,
    options: TaskListOptions & { name: string; position: number },
) {
    try {
        const response: any = await plankaRequest(
            `/api/cards/${cardId}/task-lists`,
            {
                method: "POST",
                body: options,
            },
        );
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to create task list: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Updates a task list
 *
 * @param {string} id - The ID of the task list
 * @param {TaskListOptions} options - The properties to update
 * @returns {Promise<object>} The updated task list
 */
export async function updateTaskList(id: string, options: TaskListOptions) {
    try {
        const response: any = await plankaRequest(`/api/task-lists/${id}`, {
            method: "PATCH",
            body: options,
        });
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to update task list: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Deletes a task list together with its tasks
 *
 * @param {string} id - The ID of the task list
 * @returns {Promise<{success: boolean}>} Success indicator
 */
export async function deleteTaskList(id: string) {
    try {
        await plankaRequest(`/api/task-lists/${id}`, { method: "DELETE" });
        return { success: true };
    } catch (error) {
        throw new Error(
            `Failed to delete task list: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}
