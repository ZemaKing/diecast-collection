import {describe, expect, it} from "vitest";

import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";
import {toLegacyModel} from "./legacy-adapter.ts";

const [racingModel] = buildModelSummaryFixtures();

describe("toLegacyModel", () => {
    it("maps a racing model with a driver and car number to the legacy shape", () => {
        expect(toLegacyModel(racingModel!)).toEqual({
            id: racingModel!.slug,
            name: racingModel!.name,
            year: racingModel!.year,
            brand: racingModel!.brand.name,
            manufacturer: racingModel!.manufacturer.name,
            category: racingModel!.category.name,
            carNumber: racingModel!.carNumber,
            carDriver: racingModel!.driver!.name,
            driverCountry: undefined,
            color: racingModel!.colors.map((c) => c.name),
            hex: racingModel!.liveryHex,
            thumbnail: racingModel!.image!.thumbUrl,
            imageUrl: racingModel!.image!.url,
            scale: racingModel!.scale,
        });
    });

    it("maps a road model with no driver/car number to undefined, not null", () => {
        const roadModel = buildModelSummaryFixtures().find((m) => !m.driver && !m.carNumber);
        expect(roadModel).toBeDefined();
        const legacy = toLegacyModel(roadModel!);
        expect(legacy.carDriver).toBeUndefined();
        expect(legacy.carNumber).toBeUndefined();
    });

    it("preserves a car number's leading zero as a string (DB car_number is text, not int)", () => {
        const model = {...racingModel!, carNumber: "07"};
        expect(toLegacyModel(model).carNumber).toBe("07");
    });

    it("falls back to an empty image string when a model has no image row", () => {
        const model = {...racingModel!, image: null};
        const legacy = toLegacyModel(model);
        expect(legacy.thumbnail).toBe("");
        expect(legacy.imageUrl).toBe("");
    });
});
