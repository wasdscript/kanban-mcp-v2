/**
 * @fileoverview Card membership operations for the MCP Kanban server
 *
 * Card memberships assign board members to a card (card "assignees").
 * The user must already be a member of the card's board.
 */

import { plankaRequest } from "../common/utils.js";

/**
 * Retrieves the users assigned to a card
 *
 * @param {string} cardId - The ID of the card
 * @returns {Promise<Array<object>>} Card memberships of the card
 */
export async function getCardMemberships(cardId: string) {
    const response: any = await plankaRequest(`/api/cards/${cardId}`);
    return response?.included?.cardMemberships ?? [];
}

/**
 * Assigns a user to a card
 *
 * @param {string} cardId - The ID of the card
 * @param {string} userId - The ID of the user (must be a member of the board)
 * @returns {Promise<object>} The created card membership
 */
export async function addCardMember(cardId: string, userId: string) {
    try {
        const response: any = await plankaRequest(
            `/api/cards/${cardId}/card-memberships`,
            {
                method: "POST",
                body: { userId },
            },
        );
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to add user to card: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Removes a user from a card
 *
 * @param {string} cardId - The ID of the card
 * @param {string} userId - The ID of the user to remove
 * @returns {Promise<{success: boolean}>} Success indicator
 */
export async function removeCardMember(cardId: string, userId: string) {
    try {
        await plankaRequest(
            `/api/cards/${cardId}/card-memberships/userId:${userId}`,
            { method: "DELETE" },
        );
        return { success: true };
    } catch (error) {
        throw new Error(
            `Failed to remove user from card: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Retrieves the users who can be assigned to cards of a board
 *
 * @param {string} boardId - The ID of the board
 * @returns {Promise<Array<object>>} Users visible on the board (id, name, username)
 */
export async function getBoardUsers(boardId: string) {
    const response: any = await plankaRequest(`/api/boards/${boardId}`);
    const users: any[] = response?.included?.users ?? [];
    return users.map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
    }));
}
