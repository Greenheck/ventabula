import * as D3 from 'd3';
import * as C3 from 'c3';
// import * as D3Legend 'd3-svg-legend';

import { IPlotter, IPlotterOptions, IChart, IChartAxis } from '@/interfaces';

function getCommonFactor(value: number) {
    let bottomAxisFactor: number = 10;
    while (value / bottomAxisFactor >= 1)
        bottomAxisFactor *= 10;

    return bottomAxisFactor / 10;
}

function parseNumericAxis(axis: IChartAxis, axisType: 'x' | 'y') {
    const ticks = axis.ticks.slice();
    const min = Math.min(...ticks);
    const max = Math.max(...ticks);

    const minFactor = Math.min(...ticks.filter(t => t > 0));
    const factor = axisType === 'x' ? getCommonFactor(minFactor) : 1;

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
                if (!ticks.some(tick => Math.abs(tick - v) < 0.00001))
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
function parseCategoryAxis(axis: IChartAxis, axisType: 'x' | 'y') {
    const ticks = axis.ticks.slice();

    return {
        show: true,
        type: 'category',
        label: {
            text: axis.label,
            position: axisType === 'x' ? 'outer-center' : 'outer-middle'
        },
        categories: ticks.map(tick => tick.toString())
    };
}

const layerLabelRegex = new RegExp('[ \(\),]', 'g');

export class Plotter implements IPlotter {
    public render(e: HTMLElement, data: IChart, options: IPlotterOptions = {}) {
        const xAxisType = data.type === 'sound' ? 'category' : 'numeric';

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
            types[layer.label] = layer.label === 'Max system curve' ? 'area-spline' : (data.type === 'sound' ? 'line' : 'spline');

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
                width: options.width,
                height: options.height,
            },
            padding: {
                right: !data.rightAxis ? 20 : undefined
            },
            interaction: {
                enabled: false
            },
            data: {
                xs: xAxisType !== 'category' ? xs : undefined,
                columns: [
                    ...(xAxisType !== 'category' ? data.layers.map(layer => [ `${layer.label}-x`, ...layer.points.map(p => p.x) ]) : []),
                    ...data.layers.map(layer => [ layer.label, ...layer.points.map(p => p.y) ]),
                ],
                axes: axes,
                colors: colors,
                types: types
            },
            axis: {
                x: xAxisType !== 'category' ? parseNumericAxis(data.bottomAxis, 'x') : parseCategoryAxis(data.bottomAxis, 'x'),
                y: parseNumericAxis(data.leftAxis, 'y'),
                y2: data.rightAxis && parseNumericAxis(data.rightAxis, 'y')
            },
            grid: {
                x: xAxisType !== 'category' ? {
                    lines: data.bottomAxis.ticks.map(tick => ({ value: tick }))
                } : undefined,
                y: {
                    lines: data.leftAxis.ticks.map(tick => ({ value: tick }))
                },
                lines: {
                    front: false
                }
            } as any,
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
                const zoomRect = D3.select(e).select('svg').select('g').select('.c3-zoom-rect');
                const zoomBBox: SVGRect = (<any>zoomRect.node()).getBBox();

                D3.select(e).select('svg').select('g').append('line')
                    .attr('x1', 0)
                    .attr('y1', 1)
                    .attr('x2', zoomBBox.width)
                    .attr('y2', 1)
                    .style('stroke', 'black');

                if (!data.rightAxis) {
                    D3.select(e).select('svg').select('g').append('line')
                        .attr('x1', zoomBBox.width)
                        .attr('y1', 1)
                        .attr('x2', zoomBBox.width)
                        .attr('y2', zoomBBox.height)
                        .style('stroke', 'black');
                }

                if (!options.hideInlineLabels) {
                    const prevPoints: Array<{ x: number, y: number }> = [];

                    for (let layer of data.layers.filter(l => pointShapes[l.label])) {
                        if (pointShapes[layer.label]) {
                            const testTargets = D3.selectAll(`.c3-target-${layer.label.replace(layerLabelRegex, '-')}`).selectAll('.c3-circles');
                            testTargets.each(function (d, i) {
                                const innterTestTargets = D3.select(this).selectAll('circle');
                                innterTestTargets.each(function (d, i) {
                                    const circle = D3.select(this);
                                    const x = parseFloat(circle.attr('cx'));
                                    const y = parseFloat(circle.attr('cy'));

                                    prevPoints.push({ x, y });
                                });
                            });
                        }
                    }

                    for (let layer of data.layers) {
                        if (!layer.inlineLabel)
                            continue;

                        const targetGroups = D3.select(e).select('svg').selectAll(`.c3-lines-${layer.label.replace(layerLabelRegex, '-')}`);
                        const labelTargets = targetGroups.selectAll(`.c3-line-${layer.label.replace(layerLabelRegex, '-')}`);

                        const pathLength = (labelTargets.node() as SVGPathElement).getTotalLength();

                        let startOffset = 20;

                        let startPoint: SVGPoint;
                        let invalid: boolean;
                        do {
                            invalid = false;
                            startPoint = (labelTargets.node() as SVGPathElement).getPointAtLength(startOffset);

                            if (startPoint.x < 20 || startPoint.y < 20 || (zoomBBox.x + zoomBBox.width) - startPoint.x < 5 || (zoomBBox.y + zoomBBox.height) - startPoint.y < 5) {
                                invalid = true;
                            }
                            else {
                                for (let lastPoint of prevPoints) {
                                    const distance = Math.sqrt(Math.pow(startPoint.x - lastPoint.x, 2) + Math.pow(startPoint.y - lastPoint.y, 2));

                                    if (distance < 30) {
                                        invalid = true;
                                        break;
                                    }
                                }
                            }

                            if (invalid)
                                startOffset += 5;
                        } while (invalid && startOffset < pathLength);

                        if (invalid) {
                            console.warn(`Cannot draw inline label for layer ${layer.label}, no room`);
                            continue;
                        }

                        labelTargets.attr('id', `ventabula-line-${layer.label.replace(layerLabelRegex, '-')}`);
                        const textPath = targetGroups.append('text')
                            .append('textPath')
                                .attr('xlink:href', `#ventabula-line-${layer.label.replace(layerLabelRegex, '-')}`)
                                .attr('startOffset', startOffset);
                        textPath.append('tspan')
                            .attr('dy', '-2')
                            .text(layer.inlineLabel);

                        const textLength = (textPath.node() as SVGTextPathElement).getComputedTextLength();

                        prevPoints.push(startPoint);
                        prevPoints.push((labelTargets.node() as SVGPathElement).getPointAtLength(startOffset + textLength * 0.25));
                        prevPoints.push((labelTargets.node() as SVGPathElement).getPointAtLength(startOffset + textLength * 0.5));
                        prevPoints.push((labelTargets.node() as SVGPathElement).getPointAtLength(startOffset + textLength * 0.75));
                        prevPoints.push((labelTargets.node() as SVGPathElement).getPointAtLength(startOffset + textLength));
                    }
                }

                for (let dasharrayKey in dasharrays) {
                    const testTargets = D3.selectAll(`.c3-line-${dasharrayKey.replace(layerLabelRegex, '-')}`);
                    testTargets.each(function (d, i) {
                        const line = D3.select(this);
                        line.attr('stroke-dasharray', dasharrays[dasharrayKey]);
                    });
                }

                for (let pointShapeKey in pointShapes) {
                    const testTargets = D3.selectAll(`.c3-target-${pointShapeKey.replace(layerLabelRegex, '-')}`).selectAll('.c3-circles');
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
            const layers = data.layers.filter(l => l.labelOption !== 'inline');

            const legendWidth = 300;
            const legendHeight = 200;

            const legendX = D3.scaleLinear().rangeRound([0, legendWidth]);
            const legendY = D3.scaleOrdinal<number>()
                .domain(layers.map(l => l.label))
                .range(layers.map((l, i) => 17.5 + (17.5 * i)));

            // legendX.domain([0, layers.length]);
            // legendY.domain([0, layers.length]);

            const newGroups = D3.select(options.legendElement)
                .attr('class', 'c3')
            .append('svg').selectAll('g')
                .data(layers.map(l => l.label).slice())
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