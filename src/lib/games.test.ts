import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getPaginatedGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns the requested page and metadata', async () => {
        await seedGames(db, 5);

        const result = await getPaginatedGames(db, {}, { page: 2, pageSize: 2 });

        expect(result.games.map((game) => game.title)).toEqual(['Game 03', 'Game 04']);
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(2);
        expect(result.totalGames).toBe(5);
        expect(result.totalPages).toBe(3);
    });

    it('clamps invalid pages and handles an empty result', async () => {
        const emptyResult = await getPaginatedGames(db, {}, { page: 0, pageSize: 0 });
        expect(emptyResult.games).toEqual([]);
        expect(emptyResult.page).toBe(1);
        expect(emptyResult.pageSize).toBe(1);
        expect(emptyResult.totalPages).toBe(1);

        await seedGames(db, 2);
        const lastPage = await getPaginatedGames(db, {}, { page: 99, pageSize: 2 });
        expect(lastPage.page).toBe(1);
        expect(lastPage.games).toHaveLength(2);
    });

    it('filters games by category and publisher names', async () => {
        const [strategyCategory] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [puzzleCategory] = await db
            .insert(categories)
            .values({ name: 'Puzzle', description: 'puzzle' })
            .returning({ id: categories.id });
        const [pubOne] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub one' })
            .returning({ id: publishers.id });
        const [pubTwo] = await db
            .insert(publishers)
            .values({ name: 'Pub Two', description: 'pub two' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            {
                title: 'Alpha Strategy',
                description: 'Alpha description',
                starRating: 4.0,
                categoryId: strategyCategory.id,
                publisherId: pubOne.id,
            },
            {
                title: 'Bravo Puzzle',
                description: 'Bravo description',
                starRating: 4.3,
                categoryId: puzzleCategory.id,
                publisherId: pubOne.id,
            },
            {
                title: 'Charlie Strategy',
                description: 'Charlie description',
                starRating: 4.8,
                categoryId: strategyCategory.id,
                publisherId: pubTwo.id,
            },
        ]);

        const filtered = await getAllGames(db, {
            categories: ['Strategy'],
            publishers: ['Pub One'],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
