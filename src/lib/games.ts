import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export interface GameFilters {
    categories?: string[];
    publishers?: string[];
}

export interface GamePagination {
    page?: number;
    pageSize?: number;
}

export interface PaginatedGames {
    games: Game[];
    page: number;
    pageSize: number;
    totalGames: number;
    totalPages: number;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function applyFilters(
    query: ReturnType<typeof baseGamesQuery>,
    filters: GameFilters,
): ReturnType<typeof baseGamesQuery> {
    const categoryNames = (filters.categories ?? []).filter((name) => name.trim().length > 0);
    const publisherNames = (filters.publishers ?? []).filter((name) => name.trim().length > 0);

    if (categoryNames.length === 0 && publisherNames.length === 0) {
        return query;
    }

    const conditions = [];
    if (categoryNames.length > 0) {
        conditions.push(inArray(categories.name, categoryNames));
    }
    if (publisherNames.length > 0) {
        conditions.push(inArray(publishers.name, publisherNames));
    }

    return query.where(and(...conditions)) as ReturnType<typeof baseGamesQuery>;
}

/** All games ordered by title, optionally filtered by category and publisher names. */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const baseQuery = baseGamesQuery(db);
    const query = applyFilters(baseQuery, filters);
    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Returns one stable, title-ordered page of games and pagination metadata.
 *
 * @param db Injectable database connection used to query games.
 * @param filters Optional category and publisher filters applied before paging.
 * @param pagination Optional one-based page and positive page-size settings.
 * @returns The requested page, total matching games, and total page count.
 */
export async function getPaginatedGames(
    db: Database,
    filters: GameFilters = {},
    pagination: GamePagination = {},
): Promise<PaginatedGames> {
    const allGames = await getAllGames(db, filters);
    const pageSize = Math.max(1, Math.floor(pagination.pageSize ?? 6));
    const totalGames = allGames.length;
    const totalPages = Math.max(1, Math.ceil(totalGames / pageSize));
    const page = Math.min(Math.max(1, Math.floor(pagination.page ?? 1)), totalPages);
    const start = (page - 1) * pageSize;

    return {
        games: allGames.slice(start, start + pageSize),
        page,
        pageSize,
        totalGames,
        totalPages,
    };
}

/** All categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows;
}

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows;
}

/** All game ids ordered by title, optionally filtered by category and publisher names. */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const categoryNames = (filters.categories ?? []).filter((name) => name.trim().length > 0);
    const publisherNames = (filters.publishers ?? []).filter((name) => name.trim().length > 0);
    let query = db
        .select({ id: games.id })
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));

    if (categoryNames.length > 0 || publisherNames.length > 0) {
        const conditions = [];
        if (categoryNames.length > 0) {
            conditions.push(inArray(categories.name, categoryNames));
        }
        if (publisherNames.length > 0) {
            conditions.push(inArray(publishers.name, publisherNames));
        }

        query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
