.PHONY: build socrates backward all clean

build:
	cargo build --release

backward: build
	target/release/eyelite examples/backward_demo.n3 > examples/output/backward_demo.n3

french: build
	target/release/eyelite examples/french_cities.n3 > examples/output/french_cities.n3

lldm: build
	target/release/eyelite examples/lldm.n3 > examples/output/lldm.n3

peano: build
	target/release/eyelite examples/peano.n3 > examples/output/peano.n3

socrates: build
	target/release/eyelite examples/socrates.n3 > examples/output/socrates.n3

all: backward french lldm peano socrates

clean:
	cargo clean
