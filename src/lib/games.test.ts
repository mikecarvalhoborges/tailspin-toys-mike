import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllCategories,
    getAllGameIds,
    getAllPublishers,
    getFilteredGames,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: i % 2 === 0 ? puzzle.id : strategy.id,
            publisherId: i % 2 === 0 ? pubTwo.id : pubOne.id,
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

    it('returns categories and publishers ordered by name', async () => {
        await seedGames(db, 2);

        expect((await getAllCategories(db)).map((category) => category.name)).toEqual(['Puzzle', 'Strategy']);
        expect((await getAllPublishers(db)).map((publisher) => publisher.name)).toEqual(['Pub One', 'Pub Two']);
    });

    it('filters games by one or more categories', async () => {
        await seedGames(db, 4);
        const categoryOptions = await getAllCategories(db);
        const strategy = categoryOptions.find((category) => category.name === 'Strategy');
        const puzzle = categoryOptions.find((category) => category.name === 'Puzzle');

        expect(strategy).toBeDefined();
        expect(puzzle).toBeDefined();
        const strategyGames = await getFilteredGames(db, { categoryIds: [strategy!.id] });
        const allFiltered = await getFilteredGames(db, { categoryIds: [strategy!.id, puzzle!.id] });

        expect(strategyGames.map((game) => game.title)).toEqual(['Game 01', 'Game 03']);
        expect(allFiltered).toHaveLength(4);
    });

    it('filters games by publisher and combines publisher and category filters', async () => {
        await seedGames(db, 4);
        const categories = await getAllCategories(db);
        const publishers = await getAllPublishers(db);
        const strategy = categories.find((category) => category.name === 'Strategy');
        const pubTwo = publishers.find((publisher) => publisher.name === 'Pub Two');

        expect(strategy).toBeDefined();
        expect(pubTwo).toBeDefined();
        const pubTwoGames = await getFilteredGames(db, { publisherId: pubTwo!.id });
        const combined = await getFilteredGames(db, {
            categoryIds: [strategy!.id],
            publisherId: pubTwo!.id,
        });

        expect(pubTwoGames.map((game) => game.title)).toEqual(['Game 02', 'Game 04']);
        expect(combined).toHaveLength(0);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
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
