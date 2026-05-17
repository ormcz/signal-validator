import type {ValidationManager} from "../validation.ts";

export function register_all(validator: ValidationManager) {

    validator.add("Incompatible categories", tags => {

        const categories = new Set(
            Object.keys(tags)
                .map(k => {
                    if (!k.startsWith("railway:signal:"))
                        return null;
                    return k.split(":")[2];
                })
                .filter(k => !!k) as string[]
        );

        const has = categories.has.bind(categories);


        for (let cat of [ ...categories ])
            categories.add("X" + cat.replace("_repeated", ""))
        if (["main", "main_repeated", "combined", "combined_repeated"].some(has))
            categories.add("Xhlavni");


        const any = (...x: string[]) => () => x.some(has);
        const all = (...x: string[])=> () => x.every(has);
        const exclusive = (...x: string[]) => ()=> x.filter(has).length > 1;


        const problems: (() => boolean)[] = [
            exclusive("main", "main_repeated", "combined", "combined_repeated"),
            exclusive("distant", "distant_repeated"),
            exclusive("shunting", "shunting_repeated"),
            exclusive("humping", "humping_repeated"),

            exclusive("Xshunting", "Xhlavni", "Xdistant"),
        ]

        return problems.some(fn => fn())

    });

    validator.add("Unknown signal prefix+type" ,tags => {

        const CATEGORIES = [
            "main", "main_repeated", "distant", "distant_repeated", "minor", "minor_repeated", "minor_distant", "combined", "combined_repeated",
            "shunting", "shunting_repeated", "crossing", "crossing_repeated", "crossing_distant", "crossing_info", "crossing_hint",
            "electricity", "humping", "humping_repeated", "speed_limit", "speed_limit_distant", "whistle",
            "ring", "route", "route_distant", "wrong_road", "stop", "stop_demand",
            "station_distant", "radio", "departure", "resetting_switch",
            "resetting_switch_distant", "snowplow", "short_route", "brake_test",
            "fouling_point", "helper_engine", "train_protection", "steam_locomotive",
            "station", "rack", "wheel_cleaning"
        ];

        const ALLOWED_COMBINATIONS = {
            main: new Set(["CZ-D1:hlavni_navestidlo", "CZ-D1:stuj"]),
            distant: new Set(["CZ-D1:samostatna_predvest", "CZ-D1:tabulka_s_krizem", "CZ-D1:vystraha"]),
            minor: new Set(["CZ-D1:stuj"]),
            minor_distant: new Set(["CZ-D1:vystraha"]),
            combined: new Set(["CZ-D1:hlavni_navestidlo"]),
            shunting: new Set([
                "CZ-D1:seradovaci_navestidlo", "CZ-D1:vyckavaci_navestidlo",
                "CZ-D1:posun_zakazan", "CZ-D1:oznacnik",
                "CZ-D1:hranice_obvodu_nakladiste_nebo_vlecky", "CZ-D1:navestidlo_vykolejky"
            ]),
            crossing: new Set(["CZ-D1:prejezdnik"]),
            crossing_info: new Set(["CZ-D1:kilometricka_poloha_prejezdu"]),
            crossing_hint: new Set(["CZ-D1:stit_op"]),
            humping: new Set(["CZ-D1:spadovistni_navestidlo", "CZ-D1:seradovaci_navestidlo", "CZ-D1:hlavni_navestidlo"]),
            speed_limit: new Set([
                "CZ-D1:rychlostnik", "CZ-D1:hlavni_navestidlo",
                "CZ-D1:rychlostnik_n", "CZ-D1:horni_rychlostnik_n",
                "CZ-D1:rychlostnik_n_s_pruhy", "CZ-D1:rychlostnik_r", "CZ-D1:rychlostnik_ns"
            ]),
            speed_limit_distant: new Set([
                "CZ-D1:predvestnik", "CZ-D1:hlavni_navestidlo", "CZ-D1:samostatna_predvest",
                "CZ-D1:predvestnik_n", "CZ-D1:horni_predvestnik_n",
                "CZ-D1:predvestnik_r", "CZ-D1:predvestnik_ns"
            ]),
            whistle: new Set(["CZ-D1:piskejte"]),
            stop: new Set(["CZ-D1:lichobeznikova_tabulka", "CZ-D1:konec_nastupiste", "CZ-D1:misto_zastaveni"]),
            station_distant: new Set([
                "CZ-D1:vlak_se_blizi_k_zastavce", "CZ-D1:stanoviste_samostatne_predvesti",
                "CZ-D1:stanoviste_posledniho_oddiloveho_navestidla", "CZ-D1:hlavni_navestidlo_slouceno_s_predvesti"
            ]),
            resetting_switch: new Set(["CZ-D1:navestidlo_vyhybky_se_samovratnym_prestavnikem"])
        } as any;

        for (const category of CATEGORIES) {
            const key = `railway:signal:${category}`;
            const val = tags[key];
            if (!val) continue;

            if (val.startsWith("CZ-D1:")) {
                const allowedSet = ALLOWED_COMBINATIONS[category];
                if (allowedSet && allowedSet.has(val))
                    continue;
            }

            if (val.startsWith("Cs-D1:") || val == "Cs-D1" || val == "CZ" || val == "yes" || val == "ETCS:marker")
                continue;

            return true;
        }

        return false;
    });

    validator.add("Signal type is 'yes'" ,tags => {

        const CATEGORIES = [
            "main", "main_repeated", "distant", "distant_repeated", "minor", "minor_repeated", "minor_distant", "combined", "combined_repeated",
            "shunting", "shunting_repeated", "crossing", "crossing_repeated", "crossing_distant", "crossing_info", "crossing_hint",
            "electricity", "humping", "humping_repeated", "speed_limit", "speed_limit_distant", "whistle",
            "ring", "route", "route_distant", "wrong_road", "stop", "stop_demand",
            "station_distant", "radio", "departure", "resetting_switch",
            "resetting_switch_distant", "snowplow", "short_route", "brake_test",
            "fouling_point", "helper_engine", "train_protection", "steam_locomotive",
            "station", "rack", "wheel_cleaning"
        ];

        for (const category of CATEGORIES) {
            const key = `railway:signal:${category}`;
            const val = tags[key];
            if (!val) continue;

            if (val == "yes")
                return true;
        }

        return false;
    });

    validator.add("Weird signal ref for this category", tags => {

        const ref = tags.ref;
        if (!ref) return false;

        if (tags["railway:signal:main"] || tags["railway:signal:main_repeated"] || tags["railway:signal:combined"] || tags["railway:signal:combined_repeated"])
            return !/^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS]o\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)|[LS]k\s*(_|[0-9]+)?(-[0-9]+(z?[a-z]|_)?)?$/.test(ref);

        if (tags["railway:signal:shunting_repeated"] || (tags["railway:signal:shunting"] && tags["railway:signal:shunting:repeated"] == "yes"))
            return !/^(I?X|VI{0,3}|I?V|I{0,3})?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*O\s*Se\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(_|[1-9][0-9]*)?$/.test(ref);

        if (tags["railway:signal:shunting"])
            return !/^([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(Vy|Se)\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(_|[1-9][0-9]*)?$/.test(ref);

        if (tags["railway:signal:distant_repeated"] || (tags["railway:signal:distant"] && tags["railway:signal:distant:repeated"] == "yes"))
            return !/^(I?X|VI{0,3}|I?V|I{0,3})?\s*O\s*Př\s*((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS][ok]\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)$/.test(ref);

        if (tags["railway:signal:distant"])
            return !/^Př\s*((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS][ok]\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)*$/.test(ref);

        if (tags["railway:signal:humping_repeated"] || (tags["railway:signal:humping"] && tags["railway:signal:humping:repeated"] == "yes"))
            return !/^(I?X|VI{0,3}|I?V|I{0,3})?\s*O\s*Sp\s*(_|[1-9][0-9]*)?$/.test(ref);

        if (tags["railway:signal:humping"])
            return !/^Sp\s*(_|[1-9][0-9]*)?$/.test(ref);


        return false;
    });

    validator.add("Unknown main signal function", tags => {

        for (let category of ["main", "main_repeated", "combined", "combined_repeated"]) {
            const val: string | undefined = tags[`railway:signal:${category}:function`];
            if (!val) continue;

            const vals = val.split(";").filter(v => !!v);

            if (vals.some((v) => !["entry", "exit", "intermediate", "block", "protection"].includes(v)))
                return true;
        }

        return false;
    });

    validator.add("Ref suggests different main function", (tags: any) => {

        const ref = tags.ref;
        const fun =
            tags["railway:signal:main:function"] ??
            tags["railway:signal:main_repeated:function"] ??
            tags["railway:signal:combined:function"] ??
            tags["railway:signal:combined_repeated:function"];

        if (!ref || !fun) return false;

        const patterns = {
            entry: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]$/,
            exit: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?$/,
            intermediate: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]c\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?$/,
            block: /^[LS]o\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?$/,
            protection: /^[LS]k\s*(_|[0-9]+)?(-[0-9]+(z?[a-z]|_)?)?$/,
        };

        if (fun.includes("entry"))
            return !patterns.entry.test(ref);
        if (fun.includes("exit"))
            return !patterns.exit.test(ref);
        if (fun.includes("intermediate"))
            return !patterns.intermediate.test(ref);
        if (fun.includes("block"))
            return !patterns.block.test(ref);
        if (fun.includes("protection"))
            return !patterns.protection.test(ref);

        return false;
    });

    validator.add("Ref and Cs-D1:ref mismatched", tags => {

        let ref = tags.ref;
        if (!ref) return false;
        ref = ref.replaceAll(/[_\s]+/g, "");

        for (let category of ["main", "main_repeated", "combined", "combined_repeated", "distant", "distant_repeated", "shunting", "shutning_repeated", "humping", "humping_repeated"]) {
            let val = tags[`railway:signal:${category}`];
            if (!val) continue;

            val = val.replaceAll(/[_\s]+/g, "");
            if (!val.startsWith("Cs-D1:") || val.length <= "Cs-D1:".length) continue;

            const pred = val.substring("Cs-D1:".length);
            if (pred == ref)
                continue;

            if (pred == "Se" && ref.startsWith("Se"))
                continue;

            return true;
        }

        return false;
    });

    validator.add("Weird height value", tags => {

        const CATEGORIES = [
            "main", "main_repeated", "distant", "distant_repeated", "minor", "minor_repeated", "minor_distant", "combined", "combined_repeated",
            "shunting", "shunting_repeated", "crossing", "crossing_repeated", "crossing_distant", "crossing_info", "crossing_hint",
            "electricity", "humping", "humping_repeated", "speed_limit", "speed_limit_distant", "whistle",
            "ring", "route", "route_distant", "wrong_road", "stop", "stop_demand",
            "station_distant", "radio", "departure", "resetting_switch",
            "resetting_switch_distant", "snowplow", "short_route", "brake_test",
            "fouling_point", "helper_engine", "train_protection", "steam_locomotive",
            "station", "rack", "wheel_cleaning"
        ];

        for (const category of CATEGORIES) {
            const key = `railway:signal:${category}:height`;
            const val = tags[key];
            if (!val) continue;

            if (!['normal', 'dwarf', 'tall', 'short', 'low', 'high'].includes(val)) {
                return true
            }
        }

        return false;
    });

    validator.add("Weird signal states", tags => {

        const ALLOWED_STATES = {
            "main": new Set([
                "CZ-D1:stuj", "CZ-D1:volno", "CZ-D1:jizda_vlaku_dovolena", "CZ-D1:posun_dovolen", "stop", "approach", "clear", "driving_permited", "shunting_enabled", "call_signal", "speed_limit", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
            "main_repeated": new Set([
                "stop", "approach", "clear", "driving_permited", "shunting_enabled", "call_signal", "speed_limit", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
            "combined": new Set([
                "CZ-D1:stuj", "CZ-D1:vystraha", "CZ-D1:opakovani_vystraha", "CZ-D1:volno", "CZ-D1:posun_dovolen", "stop", "approach", "clear", "driving_permited", "shunting_enabled", "call_signal", "speed_limit", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
            "combined_repeated": new Set([
                "stop", "approach", "clear", "driving_permited", "shunting_enabled", "call_signal", "speed_limit", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
            "shunting": new Set([
                "off", "CZ-D1:posun_dovolen", "CZ-D1:posun_zakazan", "shunting_enabled", "shunting_disabled", "wait_and_see", "..."
            ]),
            "shunting_repeated": new Set([
                "off", "shunting_enabled", "shunting_disabled", "..."
            ]),
            "distant": new Set([
                "CZ-D1:vystraha", "CZ-D1:opakovani_vystraha", "CZ-D1:volno", "CZ-D1:opakovani_volno", "approach", "clear", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
            "distant_repeated": new Set([
                "approach", "clear", "speed_limit_distant", "approach_speed_distant", "clear_speed_distant", "..."
            ]),
        }

        for (let [category, allowedSet] of Object.entries(ALLOWED_STATES)) {
            const key = `railway:signal:${category}:states`;
            const val = tags[key] as string | undefined;
            if (!val) continue;

            const vals = val.split(";") ?? [];

            if (vals.some(val => val && !allowedSet.has(val)))
                return true;
        }

        return false;
    });

    validator.add("States/shape mismatch", (tags) => {

        const hasSpeed = !!tags["railway:signal:minor:function"]?.includes("speed");

        for (const category of ["main", "main_repeated", "combined", "combined_repeated"]) {
            const state = tags[`railway:signal:${category}:states`];
            const lamp = tags[`railway:signal:${category}:type`];

            if (!lamp || !state)
                continue;

            let mustBeSecondYellow = false;
            const lamps = lamp
                .split(";")
                .map(s => s.trim())
                .filter(s => !!s)
                .map(s => {
                    if (s == "|") {
                        mustBeSecondYellow = false;
                        return s;
                    }
                    if (["R", "G", "W"].includes(s)) {
                        mustBeSecondYellow = true;
                        return s;
                    }
                    if (s != "Y") {
                        return s;
                    }

                    if (mustBeSecondYellow)
                        return "YY";

                    mustBeSecondYellow = true;
                    return "Y"
                });
            const states = state.split(";") ?? [];

            if (states.includes("approach") != lamps.includes("Y"))
                return true;
            if (states.includes("clear") != lamps.includes("G"))
                return true;
            if (states.includes("stop") != lamps.includes("R"))
                return true;

            const mustHaveWhite= states.includes("call_signal")
                || states.includes("shunting_enabled")
                || category.includes("repeated");
            if (mustHaveWhite != lamps.includes("W"))
                return true;

            if (states.includes("speed_limit") != lamps.includes("YY"))
                return true;

            if (hasSpeed && !states.includes("speed_limit"))
                return true;
        }

        return false;

    });


    validator.add("Speed limit with no shape", tags => {
        if (tags["railway:signal:speed_limit"] == "Cs-D1") {
            if (!tags["railway:signal:speed_limit:shape"])
                return true;
        }

        if (tags["railway:signal:speed_limit_distant"] == "Cs-D1") {
            if (!tags["railway:signal:speed_limit_distant:shape"])
                return true;
        }
        return false;
    });

    validator.add("Speed limit with weird shape", tags => {

        if (tags["railway:signal:speed_limit"] == "Cs-D1") {

            const shapes = (tags["railway:signal:speed_limit:shape"] as string ?? "").split(";").map(a => a.trim()).filter(a => !!a);
            const ALLOWED = ["Tsquare", "T|square|", "|square|", "square", "round", "NSsquare", "NSsquareX"]

            if (shapes.some(s => !ALLOWED.includes(s)))
                return true;
        }

        if (tags["railway:signal:speed_limit_distant"] == "Cs-D1") {

            const shapes = (tags["railway:signal:speed_limit_distant:shape"] as string ?? "").split(";").map(a => a.trim()).filter(a => !!a);
            const ALLOWED = ["triangle", "NSsquare", "NSsquareX"]

            if (shapes.some(s => !ALLOWED.includes(s)))
                return true;
        }

        return false;
    });

    validator.add("Likely older speed_limit tagging", tags => {

        for (let category of ["main", "main_repeated", "combined", "combined_repeated", "distant", "distant_repeated"]) {
            const val: string | undefined = tags[`railway:signal:${category}`];
            if (!val) continue;

            if (!val.startsWith("Cs-D1") && !val.startsWith("yes"))
                continue;

            if (Object.keys(tags).some(k => k.includes("speed_limit")))
                return true;

            if (Object.keys(tags).some(k => k.includes("speed_limit_distant")))
                return true;
        }

        return false;
    });

    validator.add("Minor is likely used as main signal", tags => {
        return tags["railway:signal:minor"] && !["CZ-D1", "Cs-D1", "Cz-D1", "CS-D1"].includes(tags["railway:signal:minor"])
    });

    validator.add("Weird minor function", tags => {

        const ALLOWED = [
            "group_signal", // Skupinové návěstidlo
            "speed_limit_30", "speed_sign_30", "speed_limit_50", "speed_sign_50", // Tabulka 30/50
            "speed_limit_id_30", "speed_id_30", "speed_limit_id_50", "speed_id_50", // Světlo 3/5
            "speed_line_60", "speed_limit_60", "speed_line_80", "speed_line_100", // Světelné pruhy
            "speed_limit_line", // Nebo tohle?
            "speed_limit", // -> Nutné vydedukovat z :type
            "speed_limit_matrix", "speed_matrix", // Rychlostní indikátor
            "matrix_speed", // -> Nutno vydedukovat
            "speed_limit_distant_matrix", // Předvěstní indikátor
            "first_distant_block", "last_distant_block",
            "shortened_braking",
            "arrow_track", "arrow_track_left", "arrow_track_right",
            "arrow",
            "open_crossing",
            "track_indicator", "direction_indicator",
            "distant_block", "distant_entry"
        ];


        // if (tags["railway:signal:minor"] !== "Cs-D1")
        //     return false;

        const functions = (tags["railway:signal:minor:function"] as string ?? "").split(";").map(a => a.trim()).filter(a => !!a);

        return functions.some(s => !ALLOWED.includes(s))

    });

    validator.add("Minor function not described on wiki", tags => {

        const ALLOWED = [
            "group_signal", // Skupinové návěstidlo
            "speed_sign_30", "speed_sign_50", // Tabulka 30/50
            "speed_id_30", "speed_id_50", // Světlo 3/5
            "speed_line_60", "speed_line_80", "speed_line_100", // Světelné pruhy
            "speed_limit_line", // Nebo tohle?
            "speed_limit_matrix", // Rychlostní indikátor
            "speed_limit_distant_matrix", // Předvěstní indikátor
            "first_distant_block", "last_distant_block",
            "shortened_breaking",
            "arrow_track",
            "arrow",
            "open_crossing",
            "track_indicator", "direction_indicator",
            "distant_block", "distant_entry"
        ];


        // if (tags["railway:signal:minor"] !== "Cs-D1")
        //     return false;

        const functions = (tags["railway:signal:minor:function"] as string ?? "").split(";").map(a => a.trim()).filter(a => !!a);

        return functions.some(s => !ALLOWED.includes(s))

    });

}