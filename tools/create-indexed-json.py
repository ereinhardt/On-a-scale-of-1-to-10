import argparse
import pathlib
import json
from os import listdir

EXTENSION = ".json"


def index_dir_recursive(current_path, start_dir):
    item_arr = []

    if current_path.is_file():
        if "DS_Store" in current_path.name:
            return []
        return [str(current_path.relative_to(start_dir))]

    for item in listdir(current_path):
        item_path = current_path / item

        if item_path.is_dir():
            item_arr += index_dir_recursive(item_path, start_dir)
        else:
            if "DS_Store" not in item_path.name:
                item_arr.append(str(item_path.relative_to(start_dir)))

    return item_arr


def main():

    parser = argparse.ArgumentParser(
        prog="Indexed Json File Creator",
        usage="ex: python3 tools/create-indexed-json.py --input_dir=dataset",
    )

    parser.add_argument("--input_dir", type=pathlib.Path, required=False)
    parser.add_argument(
        "--output_dir", type=pathlib.Path, required=False, default=pathlib.Path("./")
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
    output_dir = args.output_dir.joinpath(output_file_name + EXTENSION)
    indexed_dir = index_dir_recursive(input_dir, input_dir)

    with open(output_dir, "w+", encoding="utf-8") as f:
        f.write(json.dumps(indexed_dir, indent=4, ensure_ascii=False))

    print(f"succesfull written to: ./{str(output_dir)}")


if __name__ == "__main__":
    main()
