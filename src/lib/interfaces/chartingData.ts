export type LayerStyles = 'spline' | 'circleMarkers' | 'dotMarkers' | 'triangleMarkers';
export type XAxisTypes = 'bottom' | 'top';
export type YAxisTypes = 'left' | 'right';
export type BrushTypes = 'solid' | 'dotted' | 'dashed' | 'dotdashed' | 'dotdotdashed';
export type LabelOptions = 'inline';

export interface IChart {
    readonly type: string;
    readonly grid: IChartGrid;
    readonly bottomAxis: IChartAxis;
    readonly leftAxis: IChartAxis;
    readonly rightAxis?: IChartAxis;
    readonly layers: ReadonlyArray<IChartLayer>;
}
export interface IChartGrid {
    readonly rows: number;
    readonly columns: number;
}
export interface IChartAxis {
    readonly label: string;
    readonly ticks: ReadonlyArray<number>;
}
export interface IChartLayer {
    readonly label: string;
    readonly inlineLabel?: string;
    readonly labelOption?: LabelOptions;
    readonly style: LayerStyles;
    readonly xAxis: XAxisTypes;
    readonly yAxis: YAxisTypes;
    readonly bounds: IChartLayerBounds;
    readonly brush: IChartLayerBrush;
    readonly points: ReadonlyArray<IChartLayerPoint>;
}
export interface IChartLayerBounds {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
}
export interface IChartLayerBrush {
    readonly color: string;
    readonly type: BrushTypes;
}
export interface IChartLayerPoint {
    readonly x: number;
    readonly y: number;
}