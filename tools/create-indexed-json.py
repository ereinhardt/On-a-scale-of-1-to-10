import argparse
import pathlib
import json
from os import listdir

EXTENSION = ".json"


def index_dir_recursive(current_path, start_dir):
    item_arr = []

    if not current_path.is_dir():
        if "DS_Store" in str(current_path):
            return []
        else:
            return [str(current_path.relative_to(start_dir))]

    items = listdir(current_path)

    for item in items:
        item_path = pathlib.Path(item)
        if not item_path.is_dir():
            child_item_arr = index_dir_recursive(
                current_path.joinpath(item_path), start_dir
            )
            item_arr += child_item_arr  # ass Concat operator

    return item_arr


def main():

    parser = argparse.ArgumentParser(
        prog="Indexed Json File Creator",
        usage="ex: python3 tools/create-indexed-json.py --input_dir=dataset",
    )

    parser.add_argument("--input_dir", type=pathlib.Path, required=True)
    parser.add_argument(
        "--output_dir", type=pathlib.Path, required=False, default=pathlib.Path("./")
    )
    parser.add_argument(
        "--output_file_name", type=str, required=False, default="indexed_json"
    )

    args = parser.parse_args()
    output_file_name = args.output_file_name
    input_dir = args.input_dir
    output_dir = args.output_dir.joinpath(output_file_name + EXTENSION)
    indexed_dir = index_dir_recursive(input_dir, input_dir)

    with open(output_dir, "w+", encoding="utf-8") as f:
        f.write(json.dumps(indexed_dir, indent=4, ensure_ascii=False))

    print(f"succesfull written to: ./{str(output_dir)}")


if __name__ == "__main__":
    main()
