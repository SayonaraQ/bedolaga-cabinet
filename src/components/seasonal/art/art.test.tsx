// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import * as autumn from './autumn';
import * as spring from './spring';
import * as summer from './summer';
import * as winter from './winter';

const art = { ...winter, ...spring, ...summer, ...autumn };
// SHA-256 of each original mockup SVG's element tree and sorted attributes.
// Ignore instance ids, xmlns and our art label; keep every shape, colour,
// transform, gradient stop, viewBox and aspect ratio unchanged.
const referenceHashes: Record<keyof typeof art, string> = {
  SnowCap: 'c43b0dbe5a2549c26fcbd830ebfbc32fa974402f42aa4ed45bf4a1e4abecfc38',
  SnowRight: '2ae3163c0e8700f502a7c10bf9627f98192abf2b50997c24eb23d9cfdeb768d3',
  SnowFull: '9873a51e344b220a8c53d6421314c6d03179ae4f75141cd06c4f1f5437dd2219',
  Snowman: 'a1cd1d5572b81dde075c188bbe1c1010e7f6baa54a4f43e86f6046ec5974bc7f',
  GardenBed: 'b50395c403a757d5ff2d6f9188d5dc96c2f186c84c55e9358b7b7a8f2395be2a',
  GardenTulip: 'd1b03a232fa784f1bce51636f3a84867b867d0fd8894ee23f2cfd549d67d97f7',
  GardenDaffodil: '8b4d8399c3c79379b60bb7cdf4917b8fa3ec2c960868ab29dcf242cebd0733b8',
  Beach: '476a6d16dd444580efe11c1971a170015aebe2d9ca97e2c9e85b72aa6589db0e',
  Shell: '47ed4765755563c65fe3a667b343557f8f03c6b312feefe3203e08b64d8c0844',
  Palm: '33045322fb7c5dd390d205801078db7c640f5fb679bdea9a25cbc96e16f54e9b',
  Wave: 'fa25d492cb10af18fb24e0a5ec8be2493c0678e4786ee1b5dc359c2f3f52a5a9',
  MapleCluster: '0407f5309cfe3190416ece4fcae36944dfe397269d33a55d7d30b2469a29a4e9',
  MapleSingle: '327f110f4d000cb1d6d8bf4dbd4c721673b684f119e83801de6737d748c585fd',
  LeafRow: 'c23341bbe02b9140c9570d400a6a44305819b48e45127dd9774c48aa9ab04566',
};

afterEach(cleanup);

function fingerprint(svg: Element) {
  const ids = [...svg.querySelectorAll('[id]')].map((node) => node.id);
  const visit = (node: Element): unknown => [
    node.tagName,
    [...node.attributes]
      .filter((attr) => !['xmlns', 'data-seasonal-art'].includes(attr.name))
      .map(({ name, value }) => [
        name,
        ids.reduce((text, id, i) => text.split(id).join(`gradient-${i}`), value),
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
    [...node.children].map(visit),
  ];
  return createHash('sha256')
    .update(JSON.stringify(visit(svg)))
    .digest('hex');
}

it.each(Object.entries(art))(
  'preserves the exact reference shapes and colours for %s',
  (name, Art) => {
    const { container } = render(<Art />);
    const svg = container.firstElementChild;
    if (!svg) throw new Error(`Missing SVG for ${name}`);
    expect(fingerprint(svg)).toBe(referenceHashes[name as keyof typeof art]);
  },
);
