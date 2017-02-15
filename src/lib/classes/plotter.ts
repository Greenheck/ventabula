import * as D3 from 'd3';
import * as C3 from 'c3';
// import * as D3Legend 'd3-svg-legend';

import { IPlotter, IPlotterOptions, IChart, IChartAxis } from '@/interfaces';

function getCommonFactor(value: number) {
    let bottomAxisFactor: number = 10;
    while (value / bottomAxisFactor > 1)
        bottomAxisFactor *= 10;

    return bottomAxisFactor / 10;
}

function parseAxis(axis: IChartAxis, axisType: 'x' | 'y') {
    const ticks = axis.ticks.slice();
    const min = Math.min(...ticks);
    const max = Math.max(...ticks);

    const factor = getCommonFactor(max);

    const label = factor > 1 ? `${axis.label} x ${factor}` : axis.label;

    return {
        show: true,
        min: min,
        max: max,
        padding: axisType === 'x' ? { left: 0, right: 0 } : { top: 0, bottom: 0 },
        label: {
            text: label,
            position: axisType === 'x' ? 'outer-center' : 'outer-middle'
        },
        tick: {
            format: (v: number) => {
                if (ticks.indexOf(v) < 0)
                    return '';

                if (factor > 1)
                    return (Math.round((v / factor) * 1000) / 1000).toString();
                else
                    return (Math.round(v * 1000) / 1000).toString();
            },
            values: (() => {
                const count = (ticks.length - 1) * 4;

                const simulatedTicks: Array<number> = [];
                for (let i = 0; i <= count; i++)
                    simulatedTicks.push(min + ((max - min) / count) * i);

                return simulatedTicks;
            })()
        }
    };
}

export class Plotter implements IPlotter {
    public render(e: HTMLElement, data: IChart, options: IPlotterOptions) {
        const xs: any = {};
        for (let layer of data.layers)
            xs[`${layer.label}`] = `${layer.label}-x`;

        const axes: any = {};
        for (let layer of data.layers)
            axes[layer.label] = layer.yAxis === 'left' ? 'y' : 'y2';

        const colors: any = {};
        for (let layer of data.layers)
            colors[layer.label] = layer.brush.color;

        const dasharrays: any = {};
        for (let layer of data.layers) {
            switch (layer.brush.type) {
                case 'dotted':
                    dasharrays[layer.label] = '1 2';
                    break;
                case 'dashed':
                    dasharrays[layer.label] = '6';
                    break;
                case 'dotdashed':
                    dasharrays[layer.label] = '5 5 1 5';
                    break;
                case 'dotdotdashed':
                    dasharrays[layer.label] = '5 5 1 5 1 5';
                    break;
            }
        }

        const types: any = {};
        for (let layer of data.layers)
            types[layer.label] = layer.label === 'Max system curve' ? 'area-spline' : 'spline';

        const pointShapes: any = {};
        for (let layer of data.layers) {
            switch (layer.style) {
                case 'circleMarkers':
                    pointShapes[layer.label] = 'circle';
                    break;
                case 'dotMarkers':
                    pointShapes[layer.label] = 'dot';
                    break;
                case 'triangleMarkers':
                    pointShapes[layer.label] = 'triangle';
                    break;
            }
        }

        C3.generate({
            size: {
                width: options.width || 500,
                height: options.height || 350,
            },
            interaction: {
                enabled: false
            },
            data: {
                xs: xs,
                columns: [
                    ...data.layers.map(layer => [ `${layer.label}-x`, ...layer.points.map(p => p.x) ]),
                    ...data.layers.map(layer => [ layer.label, ...layer.points.map(p => p.y) ]),
                ],
                axes: axes,
                colors: colors,
                types: types
            },
            axis: {
                x: parseAxis(data.bottomAxis, 'x'),
                y: parseAxis(data.leftAxis, 'y'),
                y2: parseAxis(data.rightAxis, 'y')
            },
            grid: {
                x: {
                    lines: data.bottomAxis.ticks.map(tick => ({ value: tick }))
                },
                y: {
                    lines: data.leftAxis.ticks.map(tick => ({ value: tick }))
                }
            },
            point: {
                show: false
            },
            area: {
                above: true
            } as any,
            legend: {
                show: false
            },

            bindto: e,
            onrendered: () => {
                for (let dasharrayKey in dasharrays) {
                    const testTargets = D3.selectAll(`.c3-line-${dasharrayKey.replace(new RegExp(' ', 'g'), '-')}`);
                    testTargets.each(function (d, i) {
                        const line = D3.select(this);
                        line.attr('stroke-dasharray', dasharrays[dasharrayKey]);
                    });
                }

                for (let pointShapeKey in pointShapes) {
                    const testTargets = D3.selectAll(`.c3-target-${pointShapeKey.replace(new RegExp(' ', 'g'), '-')}`).selectAll('.c3-circles');
                    testTargets.each(function (d, i) {
                        const circles = D3.select(this);
                        const innterTestTargets = D3.select(this).selectAll('circle');
                        innterTestTargets.each(function (d, i) {
                            const circle = D3.select(this);
                            const x = parseFloat(circle.attr('cx'));
                            const y = parseFloat(circle.attr('cy'));

                            let symbol: D3.Symbol<any, any>;
                            let color = circle.style('fill');
                            let fill: string = '';
                            switch (pointShapes[pointShapeKey]) {
                                case 'triangle':
                                    symbol = D3.symbol()
                                        .type(D3.symbolTriangle)
                                        .size(80);
                                    break;
                                case 'circle':
                                    symbol = D3.symbol()
                                        .type(D3.symbolCircle)
                                        .size(100);
                                    break;
                                case 'dot':
                                    symbol = D3.symbol()
                                        .type(D3.symbolCircle)
                                        .size(25);
                                    fill = color;
                                    break;
                                default:
                                    throw new Error('Unsupported shape');
                            }

                            circles.append('path')
                                .attr('d', symbol)
                                .style('stroke', color)
                                .style('fill', fill)
                                .attr('transform', d => `translate(${x},${y})`);
                        });
                    });
                }
            }
        });

        // const ordinal = D3.scaleOrdinal()
        //     .domain(data.layers.map(l => l.label))
        //     .range(data.layers.map(l => D3.symbol().type(D3.symbolTriangle).size(150)()));
        // const legendOrdinal = D3Legend.legendSymbol()
        //     .orient('vertical')
        //     // .shape('path', D3.symbol().type(D3.symbolTriangle).size(150)())
        //     // .shapePadding(10)
        //     .scale(ordinal);

        // D3.select(el).append('svg').append('g')
        //     .attr('class', 'legendOrdinal')
        //     .attr('transform', 'translate(20, 20)')
        //     .call(legendOrdinal);

        if (options.legendElement) {
            const legendWidth = 300;
            const legendHeight = 200;

            const legendX = D3.scaleLinear().rangeRound([0, legendWidth]);
            const legendY = D3.scaleOrdinal<number>()
                .domain(data.layers.map(l => l.label))
                .range(data.layers.map((l, i) => 15 + (15 * i)));

            // legendX.domain([0, data.layers.length]);
            // legendY.domain([0, data.layers.length]);

            const newGroups = D3.select(options.legendElement)
                .attr('class', 'c3')
            .append('svg').selectAll('g')
                .data(data.layers.map(l => l.label).slice())
            .enter().append('g')
                .attr('data-id', id => id);
                // .html(id => id)
                // .each(function (id) {
                //     D3.select(this).style('background-color', chart.color(id));
                // })
                // .on('mouseover', (id) => {
                //     chart.focus(id);
                // })
                // .on('mouseout', (id) => {
                //     chart.revert();
                // })
                // .on('click', (id) => {
                //     chart.toggle(id);
                // });
            newGroups.append('text')
                .attr('x', 50)
                .attr('y', (d, i) => legendY(d))
                .text(id => id);
            newGroups.each(function (layerName) {
                const pointShape = pointShapes[layerName];
                const color = colors[layerName];
                const dasharray = dasharrays[layerName];

                switch (pointShape) {
                    case 'triangle':
                        D3.select(this).append('path')
                            .attr('d', D3.symbol()
                                .type(D3.symbolTriangle)
                                .size(80))
                            .style('stroke', color)
                            .style('fill', 'none')
                            .attr('transform', d => `translate(30,${legendY(layerName) - (2.5)})`);
                        break;
                    case 'circle':
                        D3.select(this).append('path')
                            .attr('d', D3.symbol()
                                .type(D3.symbolCircle)
                                .size(100))
                            .style('stroke', color)
                            .style('fill', 'none')
                            .attr('transform', d => `translate(30,${legendY(layerName) - (2.5)})`);
                        break;
                    case 'dot':
                        D3.select(this).append('path')
                            .attr('d', D3.symbol()
                                .type(D3.symbolCircle)
                                .size(25))
                            .style('stroke', color)
                            .style('fill', color)
                            .attr('transform', d => `translate(30,${legendY(layerName) - (2.5)})`);
                        break;
                    default:
                        D3.select(this).append('line')
                            .attr('x1', -15)
                            .attr('y1', 0)
                            .attr('x2', 15)
                            .attr('y2', 0)
                            .style('stroke', color)
                            .style('stroke-dasharray', dasharray)
                            .attr('transform', d => `translate(30,${legendY(layerName) - (2.5)})`);
                        break;
                }
            });
        }

        return this;
    }
}

// export class Plotter implements IPlotter {
//     public render(e: HTMLElement, data: IChart) {
//         const svg = D3.select(e);
//         const margin = { top: 20, right: 50, bottom: 30, left: 50 };
//         const width = +svg.attr('width') - margin.left - margin.right;
//         const height = +svg.attr('height') - margin.top - margin.bottom;
//         const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

//         const x = D3.scaleLinear().rangeRound([0, width]);
//         const y = D3.scaleLinear().rangeRound([height, 0]);
//         const y2 = D3.scaleLinear().rangeRound([height, 0]);

//         x.domain(D3.extent(data.bottomAxis.ticks.slice()) as [number, number]);
//         y.domain(D3.extent(data.leftAxis.ticks.slice()) as [number, number]);
//         y2.domain(D3.extent(data.rightAxis.ticks.slice()) as [number, number]);

//         g.append('g')
//             .attr('class', 'grid')
//             .attr('transform', `translate(0, ${height})`)
//             .call(D3.axisBottom(x)
//                 .tickValues(data.bottomAxis.ticks.slice())
//                 .tickSize(-height)
//                 .tickFormat(t => ''));
//         g.append('g')
//             .attr('class', 'grid')
//             .call(D3.axisLeft(y)
//                 .tickValues(data.leftAxis.ticks.slice())
//                 .tickSize(-width)
//                 .tickFormat(t => ''));

//         // svg.style('background-color', 'lightgrey');
//         g.append('g')
//             .attr('transform', `translate(0, ${height})`)
//             .call(D3.axisBottom(x)
//                 .tickValues(data.bottomAxis.ticks.slice()));
//         g.append('g')
//             .call(D3.axisLeft(y)
//                 .tickValues(data.leftAxis.ticks.slice()));
//         g.append('g')
//             .attr('transform', `translate(${width}, 0)`)
//             .call(D3.axisRight(y2)
//                 .tickValues(data.rightAxis.ticks.slice()));

//         for (let layer of data.layers) {
//             const line = D3.line<IChartLayerPoint>()
//                 .x(point => x(point.x))
//                 .y(point => layer.yAxis === 'left' ? y(point.y) : y2(point.y));

//             g.append('path')
//                 .data([ layer.points.slice() ])
//                 .attr('class', 'line')
//                 .attr('d', line);
//         }

//         return this;
//     }
// }