import argparse
import pathlib
import json
import re
from os import listdir

EXTENSION = ".json"
CACHE = set()


def getPath(current_path, start_dir):

    if current_path.is_file():
        if not current_path.name.lower().endswith(".png"):
            return []

        file_path = str(current_path.relative_to(start_dir))

        id_res = re.search(
            r"^(.*)/(.*)(__\d{1,4}__)(.*)$", file_path
        )  # put id in cache

        if not id_res:
            raise ValueError(f"{file_path}: Invalid File Name!")

        id = id_res.group(2)

        if id in CACHE:
            return []

        file_path = re.sub(
            r"(__\d{1,4}__)", "__**__", file_path
        )  # replace res with placeholder

        CACHE.add(id)

        return [file_path]


def traverse_dir(current_path, start_dir):
    result = {}

    # If it is a directory -> recursive
    for item in listdir(current_path):
        item_path = current_path / item

        if item_path.is_dir():
            result[item] = traverse_dir(item_path, start_dir)

        elif item_path.is_file():
            url = getPath(item_path, start_dir) 

            if len(url) > 0:
                result.setdefault("items", []).append(url[0])

    return result


def main():

    parser = argparse.ArgumentParser(
        prog="Indexed Json File Creator",
        usage="ex: python3 tools/create-indexed-json.py --input_dir=dataset",
    )

    parser.add_argument("--input_dir", type=pathlib.Path, required=False)
    parser.add_argument(
        "--output_dir", type=pathlib.Path, required=False, default=pathlib.Path("./item-data/")
    )
    parser.add_argument(
        "--output_file_name", type=str, required=False, default="indexed_json"
    )

    args = parser.parse_args()

    if args.input_dir:
        input_dir = args.input_dir
    else:
        input_str = input("Please enter the path to the input directory: ")
        input_str = input_str.strip('"').strip("'")
        input_dir = pathlib.Path(input_str)

    output_file_name = args.output_file_name
    output_dir = input_dir.joinpath(output_file_name + EXTENSION)
    indexed_dir = traverse_dir(input_dir, input_dir)

    with open(output_dir, "w+", encoding="utf-8") as f:
        f.write(json.dumps(indexed_dir, indent=4, ensure_ascii=False))

    print(f"succesfull written to: ./{str(output_dir)}")


if __name__ == "__main__":
    main()
