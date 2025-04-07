import { tick } from 'svelte';

/**
 * Smoothly scrolls to an element with the given ID.
 *
 * @param {string} id - The ID of the element to scroll to.
 * @returns {Promise<void>} A promise that resolves after the scroll action is triggered.
 */
export const scrollTo = async (id: string) => {
    await tick();
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
};