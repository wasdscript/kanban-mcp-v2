/**
 * @fileoverview Attachment operations for the MCP Kanban server
 *
 * Attachments are either links or uploaded files. To keep an AI assistant from
 * reading or writing arbitrary places on disk, files are uploaded from and
 * downloaded to one folder only: PLANKA_ATTACHMENTS_DIR, by default
 * ~/kanban-mcp-attachments.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { getAuthToken, plankaRequest } from "../common/utils.js";

/**
 * Returns the folder that files may be uploaded from and downloaded to
 */
export function getAttachmentsDir() {
    return resolve(
        process.env.PLANKA_ATTACHMENTS_DIR ||
            resolve(homedir(), "kanban-mcp-attachments"),
    );
}

/**
 * Resolves a path inside the attachments folder
 *
 * @param {string} path - Absolute path inside the folder, or a path relative to it
 * @returns {string} The absolute path
 * @throws {Error} If the path points outside the folder
 */
export function resolveInsideAttachmentsDir(path: string) {
    const dir = getAttachmentsDir();
    const full = isAbsolute(path) ? resolve(path) : resolve(dir, path);
    const rel = relative(dir, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
        throw new Error(
            `Path must be inside the attachments folder (${dir}). ` +
                `Set PLANKA_ATTACHMENTS_DIR to use another folder.`,
        );
    }
    return full;
}

/**
 * Retrieves all attachments of a card
 *
 * @param {string} cardId - The ID of the card
 * @returns {Promise<Array<object>>} Attachments of the card
 */
export async function getAttachments(cardId: string) {
    const response: any = await plankaRequest(`/api/cards/${cardId}`);
    return response?.included?.attachments ?? [];
}

/**
 * Adds a link attachment to a card
 */
export async function addLinkAttachment(
    cardId: string,
    name: string,
    url: string,
) {
    try {
        const form = new FormData();
        form.append("type", "link");
        form.append("name", name);
        form.append("url", url);
        const response: any = await plankaRequest(
            `/api/cards/${cardId}/attachments`,
            { method: "POST", body: form },
        );
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to add link attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Uploads a local file (from the attachments folder) to a card
 *
 * @param {string} cardId - The ID of the card
 * @param {string} filePath - File inside the attachments folder
 * @param {string} [name] - Attachment name (default: the file name)
 */
export async function uploadAttachment(
    cardId: string,
    filePath: string,
    name?: string,
) {
    try {
        const fullPath = resolveInsideAttachmentsDir(filePath);
        const content = await readFile(fullPath);
        const fileName = basename(fullPath);

        const form = new FormData();
        form.append("type", "file");
        form.append("name", name || fileName);
        form.append("file", new Blob([content]), fileName);
        const response: any = await plankaRequest(
            `/api/cards/${cardId}/attachments`,
            { method: "POST", body: form },
        );
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to upload attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Renames an attachment
 */
export async function updateAttachment(id: string, name: string) {
    try {
        const response: any = await plankaRequest(`/api/attachments/${id}`, {
            method: "PATCH",
            body: { name },
        });
        return response.item;
    } catch (error) {
        throw new Error(
            `Failed to update attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Deletes an attachment
 */
export async function deleteAttachment(id: string) {
    try {
        await plankaRequest(`/api/attachments/${id}`, { method: "DELETE" });
        return { success: true };
    } catch (error) {
        throw new Error(
            `Failed to delete attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

/**
 * Downloads a file attachment into the attachments folder
 *
 * @param {string} cardId - The ID of the card the attachment belongs to
 * @param {string} id - The ID of the attachment
 * @param {string} [savePath] - Target path inside the attachments folder (default: the attachment name)
 * @returns {Promise<{path: string, size: number}>} Where the file was saved
 */
export async function downloadAttachment(
    cardId: string,
    id: string,
    savePath?: string,
) {
    try {
        const attachment = (await getAttachments(cardId)).find((a: any) =>
            a.id === id
        );
        if (!attachment) {
            throw new Error(`Attachment ${id} not found in card ${cardId}`);
        }
        if (attachment.type !== "file") {
            throw new Error("Only file attachments can be downloaded");
        }

        const target = resolveInsideAttachmentsDir(
            savePath || basename(attachment.name),
        );

        const baseUrl = (process.env.PLANKA_BASE_URL || "http://localhost:3000")
            .replace(/\/api$/, "");
        const url = new URL(
            `/attachments/${id}/download/${encodeURIComponent(attachment.name)}`,
            baseUrl,
        );
        // Planka serves files outside /api and checks the access token cookie
        const token = await getAuthToken();
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Cookie: `accessToken=${token}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, buffer);
        return { path: target, size: buffer.length };
    } catch (error) {
        throw new Error(
            `Failed to download attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}
