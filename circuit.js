/**
 * Counts the number of gates for XAIG representation.
 * @param {Array<Array<any>>} C - The circuit array.
 * @returns {number} The gate count.
 */
const count_xaig = (C) =>
    C.filter(g => g.length >= 3).length;

/**
 * Counts the number of gates for AIG representation (XORs cost 3).
 * @param {Array<Array<any>>} C - The circuit array.
 * @returns {number} The gate count.
 */
const count_aig = (C) =>
    C.filter(g => g.length >= 3)
     .reduce((sum, g) => sum + (g[0] === 'xor' ? 3 : 1), 0);

/**
 * Appends a gate to the circuit and returns its index.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {string} name - The name of the gate (e.g., 'and', 'xor').
 * @param  {...any} args - The inputs to the gate.
 * @returns {number} The index of the newly added gate.
 */
const gate = (C, name, ...args) => {
    C.push([name, ...args]);
    return C.length - 1;
};

/**
 * Creates a half adder circuit.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {number} x - Input bit index.
 * @param {number} y - Input bit index.
 * @returns {[number, number]} An array containing [sum, carry] indices.
 */
const halfadder = (C, x, y) => {
    return [gate(C, 'xor', x, y), gate(C, 'and', x, y)];
};

/**
 * Creates a full adder circuit.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {number} x - Input bit index.
 * @param {number} y - Input bit index.
 * @param {number} z - Input bit index (carry-in).
 * @returns {[number, number]} An array containing [sum, carry] indices.
 */
const fulladder = (C, x, y, z) => {
    const [s1, c1] = halfadder(C, x, y);
    const [s2, c2] = halfadder(C, s1, z);
    return [s2, gate(C, 'or', c1, c2)];
};

/**
 * A compressor tree implementation, analogous to a Dadda or Wallace tree structure.
 * It reduces a 2D array of bits into a final sum.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {Array<Array<number>>} bits - A 2D array representing columns of bits to be added.
 * @returns {Array<number>} An array of the output bit indices.
 */
const compress = (C, bits) => {
    const outputs = [];
    while (bits.length > 0) {
        if (bits[0].length === 1) {
            outputs.push(bits.shift()[0]);
            continue;
        }

        let s, c;
        if (bits[0].length >= 3) {
            [s, c] = fulladder(C, ...bits[0].slice(0, 3));
            bits[0].splice(0, 3); // Removes the first 3 elements
        } else if (bits[0].length === 2) {
            [s, c] = halfadder(C, ...bits[0]);
            bits[0].splice(0, 2); // Removes the first 2 elements
        }

        bits[0].push(s);
        if (bits.length === 1) {
            bits.push([c]);
        } else {
            bits[1].push(c);
        }
    }
    return outputs;
};

/**
 * Creates a specified number of input gates.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {string} name - The base name for the inputs.
 * @param {number} n - The number of inputs to create.
 * @returns {Array<number>} An array of the input gate indices.
 */
const inputs = (C, name, n) =>
    Array.from({ length: n }, (_, i) => gate(C, `${name}${i}`));

/**
 * Creates an n-bit adder circuit.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {Array<number>} bits_a - The indices of the first set of bits.
 * @param {Array<number>} bits_b - The indices of the second set of bits.
 * @returns {Array<number>} An array of the output bit indices.
 */
const adder = (C, bits_a, bits_b) => {
    if (bits_a.length !== bits_b.length) {
        throw new Error("Input bit arrays must have the same length.");
    }
    // Emulates Python's zip(bits_a, bits_b)
    const land = bits_a.map((a, i) => [a, bits_b[i]]);
    return compress(C, land);
};

/**
 * Creates a popcount (population count) circuit, which counts the number of set bits.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {Array<number>} bits - The input bits.
 * @returns {Array<number>} An array of the output bit indices representing the count.
 */
const popcount = (C, bits) => {
    return compress(C, [bits]);
};

/**
 * Creates an n-by-n multiplier circuit.
 * @param {Array<Array<any>>} C - The circuit array.
 * @param {Array<number>} bits_a - The first operand's bits.
 * @param {Array<number>} bits_b - The second operand's bits.
 * @returns {Array<number>} An array of the output bit indices for the product.
 */
const multiplier = (C, bits_a, bits_b) => {
    const na = bits_a.length;
    const nb = bits_b.length;
    const land = Array.from({ length: na + nb - 1 }, () => []);
    
    // Create copies to modify, as the logic re-gates inputs for fan-out
    bits_a = [...bits_a];
    bits_b = [...bits_b];

    for (let d = 0; d < na + nb - 1; d++) {
        const start_i = Math.max(0, d - nb + 1);
        const end_i = Math.min(na, d + 1);
        for (let i = start_i; i < end_i; i++) {
            const j = d - i;
            let a = bits_a[i];
            let b = bits_b[j];
            // Duplicate to ease fan-out
            const new_a = bits_a[i] = gate(C, C[a][0], a);
            const new_b = bits_b[j] = gate(C, C[b][0], b);            
            land[d].push(gate(C, 'and', new_a, new_b));
        }
    }
    return compress(C, land);
};
