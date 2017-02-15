import { IChart } from './chartingData';

export interface IPlotterOptions {
    width?: number;
    height?: number;
    legendElement?: HTMLElement;
}
export interface IPlotter {
    render(e: HTMLElement, data: IChart, options: IPlotterOptions): this;
}