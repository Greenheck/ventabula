import * as D3 from 'd3';

import { Plotter} from '@/classes';

export function ventabula(e: HTMLElement, data: any, options: any) {
    const plotter = new Plotter();

    plotter.render(e, data, options);
    // (<any>D3).select("svg g.c3-grid").moveToFront();
    // (<any>D3).selectAll("c3-shape").moveToFront();
}