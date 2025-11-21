.PHONY: build socrates backward all clean

build:
	cargo build --release

socrates: build
	target/release/eyelite examples/socrates.n3 > examples/output/socrates.n3

backward: build
	target/release/eyelite examples/backward_demo.n3 > examples/output/backward_demo.n3

all: socrates backward

clean:
	cargo clean
