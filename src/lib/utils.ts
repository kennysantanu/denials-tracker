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

/**
 * Formats a date string into a more readable format.
 *
 * @param {string} date - The date string to format.
 * @returns {string} The formatted date string in MM/DD/YY format.
 */
export const formatDate = (date: string): string => {
    const dateString = date.toString();
    const formattedDate = `${dateString.substring(5, 7)}/${dateString.substring(8, 10)}/${dateString.substring(0, 4)}`;
    return formattedDate;
};