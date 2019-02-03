---
title: "[Memo] Distribute Rustc Flow"
date: 2019-01-21T10:14:58+09:00
draft: false
toc: false
comments: false
categories:
- rust
tags: 
 - rust
 - memo
---

# Entry point

## rust-lang/rust
- .travis.yml
 - x.py
  - bootstrap.py

### [.travis.yml](https://github.com/rust-lang/rust/blob/66f0e42b4e6fd719099fe327d2731abd5b66ed41/.travis.yml)
```yaml
language: shell
sudo: required
dist: xenial
services:
  - docker
addons:
  apt:
    packages:
      - gdb

git:
  depth: 2
  submodules: false

matrix:
  fast_finish: true
  include:
    # Images used in testing PR and try-build should be run first.
    - env: IMAGE=x86_64-gnu-llvm-6.0 RUST_BACKTRACE=1
      if: type = pull_request OR branch = auto

    - env: IMAGE=dist-x86_64-linux DEPLOY=1
      if: branch = try OR branch = auto

    # "alternate" deployments, these are "nightlies" but have LLVM assertions
    # turned on, they're deployed to a different location primarily for
    # additional testing.
    - env: IMAGE=dist-x86_64-linux DEPLOY_ALT=1 CI_JOB_NAME=dist-x86_64-linux-alt
      if: branch = try OR branch = auto

    - env: >
        RUST_CHECK_TARGET=dist
        RUST_CONFIGURE_ARGS="--enable-extended --enable-profiler --enable-lldb --set rust.jemalloc"
        SRC=.
        DEPLOY_ALT=1
        RUSTC_RETRY_LINKER_ON_SEGFAULT=1
        MACOSX_DEPLOYMENT_TARGET=10.7
        NO_LLVM_ASSERTIONS=1
        NO_DEBUG_ASSERTIONS=1
        CI_JOB_NAME=dist-x86_64-apple-alt
      os: osx
      osx_image: xcode9.3-moar
      if: branch = auto

    # macOS builders. These are placed near the beginning because they are very
    # slow to run.

    # OSX builders running tests, these run the full test suite.
    # NO_DEBUG_ASSERTIONS=1 to make them go faster, but also do have some
    # runners that run `//ignore-debug` tests.
    #
    # Note that the compiler is compiled to target 10.8 here because the Xcode
    # version that we're using, 8.2, cannot compile LLVM for OSX 10.7.
    - env: >
        RUST_CHECK_TARGET=check
        RUST_CONFIGURE_ARGS="--build=x86_64-apple-darwin --enable-sanitizers --enable-profiler --set rust.jemalloc"
        SRC=.
        RUSTC_RETRY_LINKER_ON_SEGFAULT=1
        MACOSX_DEPLOYMENT_TARGET=10.8
        MACOSX_STD_DEPLOYMENT_TARGET=10.7
        NO_LLVM_ASSERTIONS=1
        NO_DEBUG_ASSERTIONS=1
        CI_JOB_NAME=x86_64-apple
      os: osx
      osx_image: xcode9.3-moar
      if: branch = auto

    - env: >
        RUST_CHECK_TARGET=check
        RUST_CONFIGURE_ARGS="--build=i686-apple-darwin --set rust.jemalloc"
        SRC=.
        RUSTC_RETRY_LINKER_ON_SEGFAULT=1
        MACOSX_DEPLOYMENT_TARGET=10.8
        MACOSX_STD_DEPLOYMENT_TARGET=10.7
        NO_LLVM_ASSERTIONS=1
        NO_DEBUG_ASSERTIONS=1
        CI_JOB_NAME=i686-apple
      os: osx
      osx_image: xcode9.3-moar
      if: branch = auto

    # OSX builders producing releases. These do not run the full test suite and
    # just produce a bunch of artifacts.
    #
    # Note that these are running in the `xcode7` image instead of the
    # `xcode8.2` image as above. That's because we want to build releases for
    # OSX 10.7 and `xcode7` is the latest Xcode able to compile LLVM for 10.7.
    - env: >
        RUST_CHECK_TARGET=dist
        RUST_CONFIGURE_ARGS="--build=i686-apple-darwin --enable-full-tools --enable-profiler --enable-lldb --set rust.jemalloc"
        SRC=.
        DEPLOY=1
        RUSTC_RETRY_LINKER_ON_SEGFAULT=1
        MACOSX_DEPLOYMENT_TARGET=10.7
        NO_LLVM_ASSERTIONS=1
        NO_DEBUG_ASSERTIONS=1
        DIST_REQUIRE_ALL_TOOLS=1
        CI_JOB_NAME=dist-i686-apple
      os: osx
      osx_image: xcode9.3-moar
      if: branch = auto

    - env: >
        RUST_CHECK_TARGET=dist
        RUST_CONFIGURE_ARGS="--target=aarch64-apple-ios,armv7-apple-ios,armv7s-apple-ios,i386-apple-ios,x86_64-apple-ios --enable-full-tools --enable-sanitizers --enable-profiler --enable-lldb --set rust.jemalloc"
        SRC=.
        DEPLOY=1
        RUSTC_RETRY_LINKER_ON_SEGFAULT=1
        MACOSX_DEPLOYMENT_TARGET=10.7
        NO_LLVM_ASSERTIONS=1
        NO_DEBUG_ASSERTIONS=1
        DIST_REQUIRE_ALL_TOOLS=1
        CI_JOB_NAME=dist-x86_64-apple
      os: osx
      osx_image: xcode9.3-moar
      if: branch = auto

    # Linux builders, remaining docker images
    - env: IMAGE=x86_64-gnu
      if: branch = auto
    - env: IMAGE=x86_64-gnu-full-bootstrap
      if: branch = auto
    - env: IMAGE=x86_64-gnu-aux
      if: branch = auto
    - env: IMAGE=x86_64-gnu-tools
      if: branch = auto OR (type = pull_request AND commit_message =~ /(?i:^update.*\b(rls|rustfmt|clippy|miri|cargo)\b)/)
    - env: IMAGE=x86_64-gnu-debug
      if: branch = auto
    - env: IMAGE=x86_64-gnu-nopt
      if: branch = auto
    - env: IMAGE=x86_64-gnu-distcheck
      if: branch = auto
    - env: IMAGE=mingw-check
      if: type = pull_request OR branch = auto

    - stage: publish toolstate
      if: branch = master AND type = push
      before_install: []
      install: []
      sudo: false
      script:
        MESSAGE_FILE=$(mktemp -t msg.XXXXXX);
        . src/ci/docker/x86_64-gnu-tools/repo.sh;
        commit_toolstate_change "$MESSAGE_FILE" "$TRAVIS_BUILD_DIR/src/tools/publish_toolstate.py" "$(git rev-parse HEAD)" "$(git log --format=%s -n1 HEAD)" "$MESSAGE_FILE" "$TOOLSTATE_REPO_ACCESS_TOKEN";

before_install:
  # We'll use the AWS cli to download/upload cached docker layers as well as
  # push our deployments, so download that here.
  - pip install --user awscli; export PATH=$PATH:$HOME/.local/bin:$HOME/Library/Python/2.7/bin/
  - mkdir -p $HOME/rustsrc
  # FIXME(#46924): these two commands are required to enable IPv6,
  # they shouldn't exist, please revert once more official solutions appeared.
  # see https://github.com/travis-ci/travis-ci/issues/8891#issuecomment-353403729
  - if [ "$TRAVIS_OS_NAME" = linux ]; then
      echo '{"ipv6":true,"fixed-cidr-v6":"fd9a:8454:6789:13f7::/64"}' | sudo tee /etc/docker/daemon.json;
      sudo service docker restart;
    fi

install:
  - case "$TRAVIS_OS_NAME" in
        linux)
          travis_retry curl -fo $HOME/stamp https://s3-us-west-1.amazonaws.com/rust-lang-ci2/rust-ci-mirror/2017-03-17-stamp-x86_64-unknown-linux-musl &&
            chmod +x $HOME/stamp &&
            export PATH=$PATH:$HOME
          ;;
        osx)
          if [[ "$RUST_CHECK_TARGET" == dist ]]; then
            travis_retry brew update &&
            travis_retry brew install xz &&
            travis_retry brew install swig;
          fi &&
          travis_retry curl -fo /usr/local/bin/sccache https://s3-us-west-1.amazonaws.com/rust-lang-ci2/rust-ci-mirror/2018-04-02-sccache-x86_64-apple-darwin &&
            chmod +x /usr/local/bin/sccache &&
          travis_retry curl -fo /usr/local/bin/stamp https://s3-us-west-1.amazonaws.com/rust-lang-ci2/rust-ci-mirror/2017-03-17-stamp-x86_64-apple-darwin &&
            chmod +x /usr/local/bin/stamp &&
          travis_retry curl -f http://releases.llvm.org/7.0.0/clang+llvm-7.0.0-x86_64-apple-darwin.tar.xz | tar xJf - &&
            export CC=`pwd`/clang+llvm-7.0.0-x86_64-apple-darwin/bin/clang &&
            export CXX=`pwd`/clang+llvm-7.0.0-x86_64-apple-darwin/bin/clang++ &&
            export AR=ar
          ;;
    esac

before_script:
  - >
      echo "#### Disk usage before running script:";
      df -h;
      du . | sort -nr | head -n100
  - >
      RUN_SCRIPT="src/ci/init_repo.sh . $HOME/rustsrc";
      if [ "$TRAVIS_OS_NAME" = "osx" ]; then
          export RUN_SCRIPT="$RUN_SCRIPT && src/ci/run.sh";
      else
          export RUN_SCRIPT="$RUN_SCRIPT && src/ci/docker/run.sh $IMAGE";
          # Enable core dump on Linux.
          sudo sh -c 'echo "/checkout/obj/cores/core.%p.%E" > /proc/sys/kernel/core_pattern';
      fi
  - >
      if [ "$IMAGE" = mingw-check ]; then
        # verify the publish_toolstate script works.
        git clone --depth=1 https://github.com/rust-lang-nursery/rust-toolstate.git;
        cd rust-toolstate;
        python2.7 "$TRAVIS_BUILD_DIR/src/tools/publish_toolstate.py" "$(git rev-parse HEAD)" "$(git log --format=%s -n1 HEAD)" "" "";
        cd ..;
        rm -rf rust-toolstate;
      fi

# Log time information from this machine and an external machine for insight into possible
# clock drift. Timezones don't matter since relative deltas give all the necessary info.
script:
  - >
      date && (curl -fs --head https://google.com | grep ^Date: | sed 's/Date: //g' || true)
  - stamp sh -x -c "$RUN_SCRIPT"
  - >
      date && (curl -fs --head https://google.com | grep ^Date: | sed 's/Date: //g' || true)

after_success:
  - >
      echo "#### Build successful; Disk usage after running script:";
      df -h;
      du . | sort -nr | head -n100
  - >
      if [ "$DEPLOY$DEPLOY_ALT" == "1" ]; then
        mkdir -p deploy/$TRAVIS_COMMIT;
        if [ "$TRAVIS_OS_NAME" == "osx" ]; then
            rm -rf build/dist/doc &&
            cp -r build/dist/* deploy/$TRAVIS_COMMIT;
        else
            rm -rf obj/build/dist/doc &&
            cp -r obj/build/dist/* deploy/$TRAVIS_COMMIT;
        fi;
        ls -la deploy/$TRAVIS_COMMIT;
        deploy_dir=rustc-builds;
        if [ "$DEPLOY_ALT" == "1" ]; then
            deploy_dir=rustc-builds-alt;
        fi;
        travis_retry aws s3 cp --no-progress --recursive --acl public-read ./deploy s3://rust-lang-ci2/$deploy_dir
      fi

after_failure:
  - >
      echo "#### Build failed; Disk usage after running script:";
      df -h;
      du . | sort -nr | head -n100

  # Random attempt at debugging currently. Just poking around in here to see if
  # anything shows up.

  # Dump backtrace for macOS
  - ls -lat $HOME/Library/Logs/DiagnosticReports/
  - find $HOME/Library/Logs/DiagnosticReports
      -type f
      -name '*.crash'
      -not -name '*.stage2-*.crash'
      -not -name 'com.apple.CoreSimulator.CoreSimulatorService-*.crash'
      -exec printf travis_fold":start:crashlog\n\033[31;1m%s\033[0m\n" {} \;
      -exec head -750 {} \;
      -exec echo travis_fold":"end:crashlog \; || true

  # Dump backtrace for Linux
  - ln -s . checkout &&
    for CORE in obj/cores/core.*; do
      EXE=$(echo $CORE | sed 's|obj/cores/core\.[0-9]*\.!checkout!\(.*\)|\1|;y|!|/|');
      if [ -f "$EXE" ]; then
        printf travis_fold":start:crashlog\n\033[31;1m%s\033[0m\n" "$CORE";
        gdb --batch -q -c "$CORE" "$EXE"
          -iex 'set auto-load off'
          -iex 'dir src/'
          -iex 'set sysroot .'
          -ex bt
          -ex q;
        echo travis_fold":"end:crashlog;
      fi;
    done || true

  # see #50887
  - cat ./obj/build/x86_64-unknown-linux-gnu/native/asan/build/lib/asan/clang_rt.asan-dynamic-i386.vers || true

  # attempt to debug anything killed by the oom killer on linux, just to see if
  # it happened
  - dmesg | grep -i kill

notifications:
  email: false
```

### [src/bootstrap/bootstrap.py](https://github.com/rust-lang/rust/blob/c2863dd1b43f4f1fe63a209922f7e72db53f9663/src/bootstrap/bootstrap.py)
```python
from __future__ import absolute_import, division, print_function
import argparse
import contextlib
import datetime
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

from time import time


def get(url, path, verbose=False):
    suffix = '.sha256'
    sha_url = url + suffix
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        temp_path = temp_file.name
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as sha_file:
        sha_path = sha_file.name

    try:
        download(sha_path, sha_url, False, verbose)
        if os.path.exists(path):
            if verify(path, sha_path, False):
                if verbose:
                    print("using already-download file", path)
                return
            else:
                if verbose:
                    print("ignoring already-download file",
                          path, "due to failed verification")
                os.unlink(path)
        download(temp_path, url, True, verbose)
        if not verify(temp_path, sha_path, verbose):
            raise RuntimeError("failed verification")
        if verbose:
            print("moving {} to {}".format(temp_path, path))
        shutil.move(temp_path, path)
    finally:
        delete_if_present(sha_path, verbose)
        delete_if_present(temp_path, verbose)


def delete_if_present(path, verbose):
    """Remove the given file if present"""
    if os.path.isfile(path):
        if verbose:
            print("removing", path)
        os.unlink(path)


def download(path, url, probably_big, verbose):
    for _ in range(0, 4):
        try:
            _download(path, url, probably_big, verbose, True)
            return
        except RuntimeError:
            print("\nspurious failure, trying again")
    _download(path, url, probably_big, verbose, False)


def _download(path, url, probably_big, verbose, exception):
    if probably_big or verbose:
        print("downloading {}".format(url))
    # see http://serverfault.com/questions/301128/how-to-download
    if sys.platform == 'win32':
        run(["PowerShell.exe", "/nologo", "-Command",
             "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;",
             "(New-Object System.Net.WebClient).DownloadFile('{}', '{}')".format(url, path)],
            verbose=verbose,
            exception=exception)
    else:
        if probably_big or verbose:
            option = "-#"
        else:
            option = "-s"
        run(["curl", option,
             "-y", "30", "-Y", "10",    # timeout if speed is < 10 bytes/sec for > 30 seconds
             "--connect-timeout", "30", # timeout if cannot connect within 30 seconds
             "--retry", "3", "-Sf", "-o", path, url],
            verbose=verbose,
            exception=exception)


def verify(path, sha_path, verbose):
    """Check if the sha256 sum of the given path is valid"""
    if verbose:
        print("verifying", path)
    with open(path, "rb") as source:
        found = hashlib.sha256(source.read()).hexdigest()
    with open(sha_path, "r") as sha256sum:
        expected = sha256sum.readline().split()[0]
    verified = found == expected
    if not verified:
        print("invalid checksum:\n"
              "    found:    {}\n"
              "    expected: {}".format(found, expected))
    return verified


def unpack(tarball, dst, verbose=False, match=None):
    """Unpack the given tarball file"""
    print("extracting", tarball)
    fname = os.path.basename(tarball).replace(".tar.gz", "")
    with contextlib.closing(tarfile.open(tarball)) as tar:
        for member in tar.getnames():
            if "/" not in member:
                continue
            name = member.replace(fname + "/", "", 1)
            if match is not None and not name.startswith(match):
                continue
            name = name[len(match) + 1:]

            dst_path = os.path.join(dst, name)
            if verbose:
                print("  extracting", member)
            tar.extract(member, dst)
            src_path = os.path.join(dst, member)
            if os.path.isdir(src_path) and os.path.exists(dst_path):
                continue
            shutil.move(src_path, dst_path)
    shutil.rmtree(os.path.join(dst, fname))


def run(args, verbose=False, exception=False, **kwargs):
    """Run a child program in a new process"""
    if verbose:
        print("running: " + ' '.join(args))
    sys.stdout.flush()
    # Use Popen here instead of call() as it apparently allows powershell on
    # Windows to not lock up waiting for input presumably.
    ret = subprocess.Popen(args, **kwargs)
    code = ret.wait()
    if code != 0:
        err = "failed to run: " + ' '.join(args)
        if verbose or exception:
            raise RuntimeError(err)
        sys.exit(err)


def stage0_data(rust_root):
    """Build a dictionary from stage0.txt"""
    nightlies = os.path.join(rust_root, "src/stage0.txt")
    with open(nightlies, 'r') as nightlies:
        lines = [line.rstrip() for line in nightlies
                 if not line.startswith("#")]
        return dict([line.split(": ", 1) for line in lines if line])


def format_build_time(duration):
    """Return a nicer format for build time

    >>> format_build_time('300')
    '0:05:00'
    """
    return str(datetime.timedelta(seconds=int(duration)))


def default_build_triple():
    """Build triple as in LLVM"""
    default_encoding = sys.getdefaultencoding()
    try:
        ostype = subprocess.check_output(
            ['uname', '-s']).strip().decode(default_encoding)
        cputype = subprocess.check_output(
            ['uname', '-m']).strip().decode(default_encoding)
    except (subprocess.CalledProcessError, OSError):
        if sys.platform == 'win32':
            return 'x86_64-pc-windows-msvc'
        err = "uname not found"
        sys.exit(err)

    # The goal here is to come up with the same triple as LLVM would,
    # at least for the subset of platforms we're willing to target.
    ostype_mapper = {
        'Bitrig': 'unknown-bitrig',
        'Darwin': 'apple-darwin',
        'DragonFly': 'unknown-dragonfly',
        'FreeBSD': 'unknown-freebsd',
        'Haiku': 'unknown-haiku',
        'NetBSD': 'unknown-netbsd',
        'OpenBSD': 'unknown-openbsd'
    }

    # Consider the direct transformation first and then the special cases
    if ostype in ostype_mapper:
        ostype = ostype_mapper[ostype]
    elif ostype == 'Linux':
        os_from_sp = subprocess.check_output(
            ['uname', '-o']).strip().decode(default_encoding)
        if os_from_sp == 'Android':
            ostype = 'linux-android'
        else:
            ostype = 'unknown-linux-gnu'
    elif ostype == 'SunOS':
        ostype = 'sun-solaris'
        # On Solaris, uname -m will return a machine classification instead
        # of a cpu type, so uname -p is recommended instead.  However, the
        # output from that option is too generic for our purposes (it will
        # always emit 'i386' on x86/amd64 systems).  As such, isainfo -k
        # must be used instead.
        try:
            cputype = subprocess.check_output(
                ['isainfo', '-k']).strip().decode(default_encoding)
        except (subprocess.CalledProcessError, OSError):
            err = "isainfo not found"
            sys.exit(err)
    elif ostype.startswith('MINGW'):
        # msys' `uname` does not print gcc configuration, but prints msys
        # configuration. so we cannot believe `uname -m`:
        # msys1 is always i686 and msys2 is always x86_64.
        # instead, msys defines $MSYSTEM which is MINGW32 on i686 and
        # MINGW64 on x86_64.
        ostype = 'pc-windows-gnu'
        cputype = 'i686'
        if os.environ.get('MSYSTEM') == 'MINGW64':
            cputype = 'x86_64'
    elif ostype.startswith('MSYS'):
        ostype = 'pc-windows-gnu'
    elif ostype.startswith('CYGWIN_NT'):
        cputype = 'i686'
        if ostype.endswith('WOW64'):
            cputype = 'x86_64'
        ostype = 'pc-windows-gnu'
    else:
        err = "unknown OS type: {}".format(ostype)
        sys.exit(err)

    if cputype == 'powerpc' and ostype == 'unknown-freebsd':
        cputype = subprocess.check_output(
              ['uname', '-p']).strip().decode(default_encoding)
    cputype_mapper = {
        'BePC': 'i686',
        'aarch64': 'aarch64',
        'amd64': 'x86_64',
        'arm64': 'aarch64',
        'i386': 'i686',
        'i486': 'i686',
        'i686': 'i686',
        'i786': 'i686',
        'powerpc': 'powerpc',
        'powerpc64': 'powerpc64',
        'powerpc64le': 'powerpc64le',
        'ppc': 'powerpc',
        'ppc64': 'powerpc64',
        'ppc64le': 'powerpc64le',
        's390x': 's390x',
        'x64': 'x86_64',
        'x86': 'i686',
        'x86-64': 'x86_64',
        'x86_64': 'x86_64'
    }

    # Consider the direct transformation first and then the special cases
    if cputype in cputype_mapper:
        cputype = cputype_mapper[cputype]
    elif cputype in {'xscale', 'arm'}:
        cputype = 'arm'
        if ostype == 'linux-android':
            ostype = 'linux-androideabi'
    elif cputype == 'armv6l':
        cputype = 'arm'
        if ostype == 'linux-android':
            ostype = 'linux-androideabi'
        else:
            ostype += 'eabihf'
    elif cputype in {'armv7l', 'armv8l'}:
        cputype = 'armv7'
        if ostype == 'linux-android':
            ostype = 'linux-androideabi'
        else:
            ostype += 'eabihf'
    elif cputype == 'mips':
        if sys.byteorder == 'big':
            cputype = 'mips'
        elif sys.byteorder == 'little':
            cputype = 'mipsel'
        else:
            raise ValueError("unknown byteorder: {}".format(sys.byteorder))
    elif cputype == 'mips64':
        if sys.byteorder == 'big':
            cputype = 'mips64'
        elif sys.byteorder == 'little':
            cputype = 'mips64el'
        else:
            raise ValueError('unknown byteorder: {}'.format(sys.byteorder))
        # only the n64 ABI is supported, indicate it
        ostype += 'abi64'
    elif cputype == 'sparc' or cputype == 'sparcv9' or cputype == 'sparc64':
        pass
    else:
        err = "unknown cpu type: {}".format(cputype)
        sys.exit(err)

    return "{}-{}".format(cputype, ostype)


@contextlib.contextmanager
def output(filepath):
    tmp = filepath + '.tmp'
    with open(tmp, 'w') as f:
        yield f
    try:
        os.remove(filepath)  # PermissionError/OSError on Win32 if in use
        os.rename(tmp, filepath)
    except OSError:
        shutil.copy2(tmp, filepath)
        os.remove(tmp)


class RustBuild(object):
    """Provide all the methods required to build Rust"""
    def __init__(self):
        self.cargo_channel = ''
        self.date = ''
        self._download_url = 'https://static.rust-lang.org'
        self.rustc_channel = ''
        self.build = ''
        self.build_dir = os.path.join(os.getcwd(), "build")
        self.clean = False
        self.config_toml = ''
        self.rust_root = ''
        self.use_locked_deps = ''
        self.use_vendored_sources = ''
        self.verbose = False

    def download_stage0(self):
        """Fetch the build system for Rust, written in Rust

        This method will build a cache directory, then it will fetch the
        tarball which has the stage0 compiler used to then bootstrap the Rust
        compiler itself.

        Each downloaded tarball is extracted, after that, the script
        will move all the content to the right place.
        """
        rustc_channel = self.rustc_channel
        cargo_channel = self.cargo_channel

        if self.rustc().startswith(self.bin_root()) and \
                (not os.path.exists(self.rustc()) or
                 self.program_out_of_date(self.rustc_stamp())):
            if os.path.exists(self.bin_root()):
                shutil.rmtree(self.bin_root())
            filename = "rust-std-{}-{}.tar.gz".format(
                rustc_channel, self.build)
            pattern = "rust-std-{}".format(self.build)
            self._download_stage0_helper(filename, pattern)

            filename = "rustc-{}-{}.tar.gz".format(rustc_channel, self.build)
            self._download_stage0_helper(filename, "rustc")
            self.fix_executable("{}/bin/rustc".format(self.bin_root()))
            self.fix_executable("{}/bin/rustdoc".format(self.bin_root()))
            with output(self.rustc_stamp()) as rust_stamp:
                rust_stamp.write(self.date)

            # This is required so that we don't mix incompatible MinGW
            # libraries/binaries that are included in rust-std with
            # the system MinGW ones.
            if "pc-windows-gnu" in self.build:
                filename = "rust-mingw-{}-{}.tar.gz".format(
                    rustc_channel, self.build)
                self._download_stage0_helper(filename, "rust-mingw")

        if self.cargo().startswith(self.bin_root()) and \
                (not os.path.exists(self.cargo()) or
                 self.program_out_of_date(self.cargo_stamp())):
            filename = "cargo-{}-{}.tar.gz".format(cargo_channel, self.build)
            self._download_stage0_helper(filename, "cargo")
            self.fix_executable("{}/bin/cargo".format(self.bin_root()))
            with output(self.cargo_stamp()) as cargo_stamp:
                cargo_stamp.write(self.date)

    def _download_stage0_helper(self, filename, pattern):
        cache_dst = os.path.join(self.build_dir, "cache")
        rustc_cache = os.path.join(cache_dst, self.date)
        if not os.path.exists(rustc_cache):
            os.makedirs(rustc_cache)

        url = "{}/dist/{}".format(self._download_url, self.date)
        tarball = os.path.join(rustc_cache, filename)
        if not os.path.exists(tarball):
            get("{}/{}".format(url, filename), tarball, verbose=self.verbose)
        unpack(tarball, self.bin_root(), match=pattern, verbose=self.verbose)

    @staticmethod
    def fix_executable(fname):
        """Modifies the interpreter section of 'fname' to fix the dynamic linker

        This method is only required on NixOS and uses the PatchELF utility to
        change the dynamic linker of ELF executables.

        Please see https://nixos.org/patchelf.html for more information
        """
        default_encoding = sys.getdefaultencoding()
        try:
            ostype = subprocess.check_output(
                ['uname', '-s']).strip().decode(default_encoding)
        except subprocess.CalledProcessError:
            return
        except OSError as reason:
            if getattr(reason, 'winerror', None) is not None:
                return
            raise reason

        if ostype != "Linux":
            return

        if not os.path.exists("/etc/NIXOS"):
            return
        if os.path.exists("/lib"):
            return

        # At this point we're pretty sure the user is running NixOS
        nix_os_msg = "info: you seem to be running NixOS. Attempting to patch"
        print(nix_os_msg, fname)

        try:
            interpreter = subprocess.check_output(
                ["patchelf", "--print-interpreter", fname])
            interpreter = interpreter.strip().decode(default_encoding)
        except subprocess.CalledProcessError as reason:
            print("warning: failed to call patchelf:", reason)
            return

        loader = interpreter.split("/")[-1]

        try:
            ldd_output = subprocess.check_output(
                ['ldd', '/run/current-system/sw/bin/sh'])
            ldd_output = ldd_output.strip().decode(default_encoding)
        except subprocess.CalledProcessError as reason:
            print("warning: unable to call ldd:", reason)
            return

        for line in ldd_output.splitlines():
            libname = line.split()[0]
            if libname.endswith(loader):
                loader_path = libname[:len(libname) - len(loader)]
                break
        else:
            print("warning: unable to find the path to the dynamic linker")
            return

        correct_interpreter = loader_path + loader

        try:
            subprocess.check_output(
                ["patchelf", "--set-interpreter", correct_interpreter, fname])
        except subprocess.CalledProcessError as reason:
            print("warning: failed to call patchelf:", reason)
            return

    def rustc_stamp(self):
        """Return the path for .rustc-stamp

        >>> rb = RustBuild()
        >>> rb.build_dir = "build"
        >>> rb.rustc_stamp() == os.path.join("build", "stage0", ".rustc-stamp")
        True
        """
        return os.path.join(self.bin_root(), '.rustc-stamp')

    def cargo_stamp(self):
        """Return the path for .cargo-stamp

        >>> rb = RustBuild()
        >>> rb.build_dir = "build"
        >>> rb.cargo_stamp() == os.path.join("build", "stage0", ".cargo-stamp")
        True
        """
        return os.path.join(self.bin_root(), '.cargo-stamp')

    def program_out_of_date(self, stamp_path):
        """Check if the given program stamp is out of date"""
        if not os.path.exists(stamp_path) or self.clean:
            return True
        with open(stamp_path, 'r') as stamp:
            return self.date != stamp.read()

    def bin_root(self):
        """Return the binary root directory

        >>> rb = RustBuild()
        >>> rb.build_dir = "build"
        >>> rb.bin_root() == os.path.join("build", "stage0")
        True

        When the 'build' property is given should be a nested directory:

        >>> rb.build = "devel"
        >>> rb.bin_root() == os.path.join("build", "devel", "stage0")
        True
        """
        return os.path.join(self.build_dir, self.build, "stage0")

    def get_toml(self, key, section=None):
        """Returns the value of the given key in config.toml, otherwise returns None

        >>> rb = RustBuild()
        >>> rb.config_toml = 'key1 = "value1"\\nkey2 = "value2"'
        >>> rb.get_toml("key2")
        'value2'

        If the key does not exists, the result is None:

        >>> rb.get_toml("key3") is None
        True

        Optionally also matches the section the key appears in

        >>> rb.config_toml = '[a]\\nkey = "value1"\\n[b]\\nkey = "value2"'
        >>> rb.get_toml('key', 'a')
        'value1'
        >>> rb.get_toml('key', 'b')
        'value2'
        >>> rb.get_toml('key', 'c') is None
        True
        """

        cur_section = None
        for line in self.config_toml.splitlines():
            section_match = re.match(r'^\s*\[(.*)\]\s*$', line)
            if section_match is not None:
                cur_section = section_match.group(1)

            match = re.match(r'^{}\s*=(.*)$'.format(key), line)
            if match is not None:
                value = match.group(1)
                if section is None or section == cur_section:
                    return self.get_string(value) or value.strip()
        return None

    def cargo(self):
        """Return config path for cargo"""
        return self.program_config('cargo')

    def rustc(self):
        """Return config path for rustc"""
        return self.program_config('rustc')

    def program_config(self, program):
        """Return config path for the given program

        >>> rb = RustBuild()
        >>> rb.config_toml = 'rustc = "rustc"\\n'
        >>> rb.program_config('rustc')
        'rustc'
        >>> rb.config_toml = ''
        >>> cargo_path = rb.program_config('cargo')
        >>> cargo_path.rstrip(".exe") == os.path.join(rb.bin_root(),
        ... "bin", "cargo")
        True
        """
        config = self.get_toml(program)
        if config:
            return os.path.expanduser(config)
        return os.path.join(self.bin_root(), "bin", "{}{}".format(
            program, self.exe_suffix()))

    @staticmethod
    def get_string(line):
        """Return the value between double quotes

        >>> RustBuild.get_string('    "devel"   ')
        'devel'
        """
        start = line.find('"')
        if start != -1:
            end = start + 1 + line[start + 1:].find('"')
            return line[start + 1:end]
        start = line.find('\'')
        if start != -1:
            end = start + 1 + line[start + 1:].find('\'')
            return line[start + 1:end]
        return None

    @staticmethod
    def exe_suffix():
        """Return a suffix for executables"""
        if sys.platform == 'win32':
            return '.exe'
        return ''

    def bootstrap_binary(self):
        """Return the path of the bootstrap binary

        >>> rb = RustBuild()
        >>> rb.build_dir = "build"
        >>> rb.bootstrap_binary() == os.path.join("build", "bootstrap",
        ... "debug", "bootstrap")
        True
        """
        return os.path.join(self.build_dir, "bootstrap", "debug", "bootstrap")

    def build_bootstrap(self):
        """Build bootstrap"""
        build_dir = os.path.join(self.build_dir, "bootstrap")
        if self.clean and os.path.exists(build_dir):
            shutil.rmtree(build_dir)
        env = os.environ.copy()
        env["RUSTC_BOOTSTRAP"] = '1'
        env["CARGO_TARGET_DIR"] = build_dir
        env["RUSTC"] = self.rustc()
        env["LD_LIBRARY_PATH"] = os.path.join(self.bin_root(), "lib") + \
            (os.pathsep + env["LD_LIBRARY_PATH"]) \
            if "LD_LIBRARY_PATH" in env else ""
        env["DYLD_LIBRARY_PATH"] = os.path.join(self.bin_root(), "lib") + \
            (os.pathsep + env["DYLD_LIBRARY_PATH"]) \
            if "DYLD_LIBRARY_PATH" in env else ""
        env["LIBRARY_PATH"] = os.path.join(self.bin_root(), "lib") + \
            (os.pathsep + env["LIBRARY_PATH"]) \
            if "LIBRARY_PATH" in env else ""
        env["RUSTFLAGS"] = "-Cdebuginfo=2 "

        build_section = "target.{}".format(self.build_triple())
        target_features = []
        if self.get_toml("crt-static", build_section) == "true":
            target_features += ["+crt-static"]
        elif self.get_toml("crt-static", build_section) == "false":
            target_features += ["-crt-static"]
        if target_features:
            env["RUSTFLAGS"] += "-C target-feature=" + (",".join(target_features)) + " "
        target_linker = self.get_toml("linker", build_section)
        if target_linker is not None:
            env["RUSTFLAGS"] += "-C linker=" + target_linker + " "

        env["PATH"] = os.path.join(self.bin_root(), "bin") + \
            os.pathsep + env["PATH"]
        if not os.path.isfile(self.cargo()):
            raise Exception("no cargo executable found at `{}`".format(
                self.cargo()))
        args = [self.cargo(), "build", "--manifest-path",
                os.path.join(self.rust_root, "src/bootstrap/Cargo.toml")]
        for _ in range(1, self.verbose):
            args.append("--verbose")
        if self.use_locked_deps:
            args.append("--locked")
        if self.use_vendored_sources:
            args.append("--frozen")
        run(args, env=env, verbose=self.verbose)

    def build_triple(self):
        """Build triple as in LLVM"""
        config = self.get_toml('build')
        if config:
            return config
        return default_build_triple()

    def check_submodule(self, module, slow_submodules):
        if not slow_submodules:
            checked_out = subprocess.Popen(["git", "rev-parse", "HEAD"],
                                           cwd=os.path.join(self.rust_root, module),
                                           stdout=subprocess.PIPE)
            return checked_out
        else:
            return None

    def update_submodule(self, module, checked_out, recorded_submodules):
        module_path = os.path.join(self.rust_root, module)

        if checked_out != None:
            default_encoding = sys.getdefaultencoding()
            checked_out = checked_out.communicate()[0].decode(default_encoding).strip()
            if recorded_submodules[module] == checked_out:
                return

        print("Updating submodule", module)

        run(["git", "submodule", "-q", "sync", module],
            cwd=self.rust_root, verbose=self.verbose)
        run(["git", "submodule", "update",
            "--init", "--recursive", "--progress", module],
            cwd=self.rust_root, verbose=self.verbose)
        run(["git", "reset", "-q", "--hard"],
            cwd=module_path, verbose=self.verbose)
        run(["git", "clean", "-qdfx"],
            cwd=module_path, verbose=self.verbose)

    def update_submodules(self):
        """Update submodules"""
        if (not os.path.exists(os.path.join(self.rust_root, ".git"))) or \
                self.get_toml('submodules') == "false":
            return
        slow_submodules = self.get_toml('fast-submodules') == "false"
        start_time = time()
        if slow_submodules:
            print('Unconditionally updating all submodules')
        else:
            print('Updating only changed submodules')
        default_encoding = sys.getdefaultencoding()
        submodules = [s.split(' ', 1)[1] for s in subprocess.check_output(
            ["git", "config", "--file",
             os.path.join(self.rust_root, ".gitmodules"),
             "--get-regexp", "path"]
        ).decode(default_encoding).splitlines()]
        filtered_submodules = []
        submodules_names = []
        for module in submodules:
            if module.endswith("llvm"):
                if self.get_toml('llvm-config'):
                    continue
            if module.endswith("llvm-emscripten"):
                backends = self.get_toml('codegen-backends')
                if backends is None or not 'emscripten' in backends:
                    continue
            if module.endswith("lld"):
                config = self.get_toml('lld')
                if config is None or config == 'false':
                    continue
            if module.endswith("lldb") or module.endswith("clang"):
                config = self.get_toml('lldb')
                if config is None or config == 'false':
                    continue
            check = self.check_submodule(module, slow_submodules)
            filtered_submodules.append((module, check))
            submodules_names.append(module)
        recorded = subprocess.Popen(["git", "ls-tree", "HEAD"] + submodules_names,
                                    cwd=self.rust_root, stdout=subprocess.PIPE)
        recorded = recorded.communicate()[0].decode(default_encoding).strip().splitlines()
        recorded_submodules = {}
        for data in recorded:
            data = data.split()
            recorded_submodules[data[3]] = data[2]
        for module in filtered_submodules:
            self.update_submodule(module[0], module[1], recorded_submodules)
        print("Submodules updated in %.2f seconds" % (time() - start_time))

    def set_dev_environment(self):
        """Set download URL for development environment"""
        self._download_url = 'https://dev-static.rust-lang.org'


def bootstrap(help_triggered):
    """Configure, fetch, build and run the initial bootstrap"""

    # If the user is asking for help, let them know that the whole download-and-build
    # process has to happen before anything is printed out.
    if help_triggered:
        print("info: Downloading and building bootstrap before processing --help")
        print("      command. See src/bootstrap/README.md for help with common")
        print("      commands.")

    parser = argparse.ArgumentParser(description='Build rust')
    parser.add_argument('--config')
    parser.add_argument('--build')
    parser.add_argument('--src')
    parser.add_argument('--clean', action='store_true')
    parser.add_argument('-v', '--verbose', action='count', default=0)

    args = [a for a in sys.argv if a != '-h' and a != '--help']
    args, _ = parser.parse_known_args(args)

    # Configure initial bootstrap
    build = RustBuild()
    build.rust_root = args.src or os.path.abspath(os.path.join(__file__, '../../..'))
    build.verbose = args.verbose
    build.clean = args.clean

    try:
        with open(args.config or 'config.toml') as config:
            build.config_toml = config.read()
    except (OSError, IOError):
        pass

    match = re.search(r'\nverbose = (\d+)', build.config_toml)
    if match is not None:
        build.verbose = max(build.verbose, int(match.group(1)))

    build.use_vendored_sources = '\nvendor = true' in build.config_toml

    build.use_locked_deps = '\nlocked-deps = true' in build.config_toml

    if 'SUDO_USER' in os.environ and not build.use_vendored_sources:
        if os.environ.get('USER') != os.environ['SUDO_USER']:
            build.use_vendored_sources = True
            print('info: looks like you are running this command under `sudo`')
            print('      and so in order to preserve your $HOME this will now')
            print('      use vendored sources by default. Note that if this')
            print('      does not work you should run a normal build first')
            print('      before running a command like `sudo ./x.py install`')

    if build.use_vendored_sources:
        if not os.path.exists('.cargo'):
            os.makedirs('.cargo')
        with output('.cargo/config') as cargo_config:
            cargo_config.write("""
                [source.crates-io]
                replace-with = 'vendored-sources'
                registry = 'https://example.com'

                [source.vendored-sources]
                directory = '{}/vendor'
            """.format(build.rust_root))
    else:
        if os.path.exists('.cargo'):
            shutil.rmtree('.cargo')

    data = stage0_data(build.rust_root)
    build.date = data['date']
    build.rustc_channel = data['rustc']
    build.cargo_channel = data['cargo']

    if 'dev' in data:
        build.set_dev_environment()

    build.update_submodules()

    # Fetch/build the bootstrap
    build.build = args.build or build.build_triple()
    build.download_stage0()
    sys.stdout.flush()
    build.build_bootstrap()
    sys.stdout.flush()

    # Run the bootstrap
    args = [build.bootstrap_binary()]
    args.extend(sys.argv[1:])
    env = os.environ.copy()
    env["BUILD"] = build.build
    env["SRC"] = build.rust_root
    env["BOOTSTRAP_PARENT_ID"] = str(os.getpid())
    env["BOOTSTRAP_PYTHON"] = sys.executable
    env["BUILD_DIR"] = build.build_dir
    env["RUSTC_BOOTSTRAP"] = '1'
    env["CARGO"] = build.cargo()
    env["RUSTC"] = build.rustc()
    run(args, env=env, verbose=build.verbose)


def main():
    """Entry point for the bootstrap process"""
    start_time = time()

    # x.py help <cmd> ...
    if len(sys.argv) > 1 and sys.argv[1] == 'help':
        sys.argv = sys.argv[:1] + [sys.argv[2], '-h'] + sys.argv[3:]

    help_triggered = (
        '-h' in sys.argv) or ('--help' in sys.argv) or (len(sys.argv) == 1)
    try:
        bootstrap(help_triggered)
        if not help_triggered:
            print("Build completed successfully in {}".format(
                format_build_time(time() - start_time)))
    except (SystemExit, KeyboardInterrupt) as error:
        if hasattr(error, 'code') and isinstance(error.code, int):
            exit_code = error.code
        else:
            exit_code = 1
            print(error)
        if not help_triggered:
            print("Build completed unsuccessfully in {}".format(
                format_build_time(time() - start_time)))
        sys.exit(exit_code)


if __name__ == '__main__':
    main()
```

### [init_repo.sh](https://github.com/rust-lang/rust/blob/2a663555ddf36f6b041445894a8c175cd1bc718c/src/ci/init_repo.sh)
```shell
#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

ci_dir=$(cd $(dirname $0) && pwd)
. "$ci_dir/shared.sh"

travis_fold start init_repo
travis_time_start

REPO_DIR="$1"
CACHE_DIR="$2"

cache_src_dir="$CACHE_DIR/src"

if [ ! -d "$REPO_DIR" -o ! -d "$REPO_DIR/.git" ]; then
    echo "Error: $REPO_DIR does not exist or is not a git repo"
    exit 1
fi
cd $REPO_DIR
if [ ! -d "$CACHE_DIR" ]; then
    echo "Error: $CACHE_DIR does not exist or is not an absolute path"
    exit 1
fi

rm -rf "$CACHE_DIR"
mkdir "$CACHE_DIR"

# On the beta channel we'll be automatically calculating the prerelease version
# via the git history, so unshallow our shallow clone from CI.
if grep -q RUST_RELEASE_CHANNEL=beta src/ci/run.sh; then
  git fetch origin --unshallow beta master
fi

function fetch_submodule {
    local module=$1
    local cached="download-${module//\//-}.tar.gz"
    retry sh -c "rm -f $cached && \
        curl -sSL -o $cached $2"
    mkdir $module
    touch "$module/.git"
    tar -C $module --strip-components=1 -xf $cached
    rm $cached
}

included="src/llvm src/llvm-emscripten src/doc/book src/doc/rust-by-example"
included="$included src/tools/lld src/tools/clang src/tools/lldb"
modules="$(git config --file .gitmodules --get-regexp '\.path$' | cut -d' ' -f2)"
modules=($modules)
use_git=""
urls="$(git config --file .gitmodules --get-regexp '\.url$' | cut -d' ' -f2)"
urls=($urls)
for i in ${!modules[@]}; do
    module=${modules[$i]}
    if [[ " $included " = *" $module "* ]]; then
        commit="$(git ls-tree HEAD $module | awk '{print $3}')"
        git rm $module
        url=${urls[$i]}
        url=${url/\.git/}
        fetch_submodule $module "$url/archive/$commit.tar.gz" &
        continue
    else
        use_git="$use_git $module"
    fi
done
retry sh -c "git submodule deinit -f $use_git && \
    git submodule sync && \
    git submodule update -j 16 --init --recursive $use_git"
wait
travis_fold end init_repo
travis_time_finish
```

### [src/ci/run.sh](https://github.com/rust-lang/rust/blob/d158ef64e820041110bc5519abb9012010cc2cf0/src/ci/run.sh)

```shell
#!/usr/bin/env bash

set -e

if [ -n "$CI_JOB_NAME" ]; then
  echo "[CI_JOB_NAME=$CI_JOB_NAME]"
fi

if [ "$NO_CHANGE_USER" = "" ]; then
  if [ "$LOCAL_USER_ID" != "" ]; then
    useradd --shell /bin/bash -u $LOCAL_USER_ID -o -c "" -m user
    export HOME=/home/user
    unset LOCAL_USER_ID
    exec su --preserve-environment -c "env PATH=$PATH \"$0\"" user
  fi
fi

# only enable core dump on Linux
if [ -f /proc/sys/kernel/core_pattern ]; then
  ulimit -c unlimited
fi

ci_dir=`cd $(dirname $0) && pwd`
source "$ci_dir/shared.sh"

if [ "$TRAVIS" != "true" ] || [ "$TRAVIS_BRANCH" == "auto" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --set build.print-step-timings --enable-verbose-tests"
fi

RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-sccache"
RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --disable-manage-submodules"
RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-locked-deps"
RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-cargo-native-static"
RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --set rust.codegen-units-std=1"

if [ "$DIST_SRC" = "" ]; then
  RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --disable-dist-src"
fi

# If we're deploying artifacts then we set the release channel, otherwise if
# we're not deploying then we want to be sure to enable all assertions because
# we'll be running tests
#
# FIXME: need a scheme for changing this `nightly` value to `beta` and `stable`
#        either automatically or manually.
export RUST_RELEASE_CHANNEL=nightly
if [ "$DEPLOY$DEPLOY_ALT" != "" ]; then
  RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --release-channel=$RUST_RELEASE_CHANNEL"
  RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-llvm-static-stdcpp"
  RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --set rust.remap-debuginfo"

  if [ "$NO_LLVM_ASSERTIONS" = "1" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --disable-llvm-assertions"
  elif [ "$DEPLOY_ALT" != "" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-llvm-assertions"
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --set rust.verify-llvm-ir"
  fi
else
  # We almost always want debug assertions enabled, but sometimes this takes too
  # long for too little benefit, so we just turn them off.
  if [ "$NO_DEBUG_ASSERTIONS" = "" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-debug-assertions"
  fi

  # In general we always want to run tests with LLVM assertions enabled, but not
  # all platforms currently support that, so we have an option to disable.
  if [ "$NO_LLVM_ASSERTIONS" = "" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-llvm-assertions"
  fi

  RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --set rust.verify-llvm-ir"
fi

if [ "$RUST_RELEASE_CHANNEL" = "nightly" ] || [ "$DIST_REQUIRE_ALL_TOOLS" = "" ]; then
    RUST_CONFIGURE_ARGS="$RUST_CONFIGURE_ARGS --enable-missing-tools"
fi

# We've had problems in the past of shell scripts leaking fds into the sccache
# server (#48192) which causes Cargo to erroneously think that a build script
# hasn't finished yet. Try to solve that problem by starting a very long-lived
# sccache server at the start of the build, but no need to worry if this fails.
SCCACHE_IDLE_TIMEOUT=10800 sccache --start-server || true

if [ "$RUN_CHECK_WITH_PARALLEL_QUERIES" != "" ]; then
  $SRC/configure --enable-experimental-parallel-queries
  CARGO_INCREMENTAL=0 python2.7 ../x.py check
  rm -f config.toml
  rm -rf build
fi

travis_fold start configure
travis_time_start
$SRC/configure $RUST_CONFIGURE_ARGS
travis_fold end configure
travis_time_finish

travis_fold start make-prepare
travis_time_start
retry make prepare
travis_fold end make-prepare
travis_time_finish

travis_fold start check-bootstrap
travis_time_start
make check-bootstrap
travis_fold end check-bootstrap
travis_time_finish

# Display the CPU and memory information. This helps us know why the CI timing
# is fluctuating.
travis_fold start log-system-info
if [ "$TRAVIS_OS_NAME" = "osx" ]; then
    system_profiler SPHardwareDataType || true
    sysctl hw || true
    ncpus=$(sysctl -n hw.ncpu)
else
    cat /proc/cpuinfo || true
    cat /proc/meminfo || true
    ncpus=$(grep processor /proc/cpuinfo | wc -l)
fi
travis_fold end log-system-info

if [ ! -z "$SCRIPT" ]; then
  sh -x -c "$SCRIPT"
else
  do_make() {
    travis_fold start "make-$1"
    travis_time_start
    echo "make -j $ncpus $1"
    make -j $ncpus $1
    local retval=$?
    travis_fold end "make-$1"
    travis_time_finish
    return $retval
  }

  do_make tidy
  do_make all
  do_make "$RUST_CHECK_TARGET"
fi
```

### [src/ci/shared.sh](https://github.com/rust-lang/rust/blob/2a663555ddf36f6b041445894a8c175cd1bc718c/src/ci/shared.sh)
```shell
#!/bin/false

# This file is intended to be sourced with `. shared.sh` or
# `source shared.sh`, hence the invalid shebang and not being
# marked as an executable file in git.

# See http://unix.stackexchange.com/questions/82598
function retry {
  echo "Attempting with retry:" "$@"
  local n=1
  local max=5
  while true; do
    "$@" && break || {
      if [[ $n -lt $max ]]; then
        sleep $n  # don't retry immediately
        ((n++))
        echo "Command failed. Attempt $n/$max:"
      else
        echo "The command has failed after $n attempts."
        return 1
      fi
    }
  done
}

if ! declare -F travis_fold; then
  if [ "${TRAVIS-false}" = 'true' ]; then
    # This is a trimmed down copy of
    # https://github.com/travis-ci/travis-build/blob/master/lib/travis/build/templates/header.sh
    travis_fold() {
      echo -en "travis_fold:$1:$2\r\033[0K"
    }
    travis_time_start() {
      travis_timer_id=$(printf %08x $(( RANDOM * RANDOM )))
      travis_start_time=$(travis_nanoseconds)
      echo -en "travis_time:start:$travis_timer_id\r\033[0K"
    }
    travis_time_finish() {
      travis_end_time=$(travis_nanoseconds)
      local duration=$(($travis_end_time-$travis_start_time))
      local msg="travis_time:end:$travis_timer_id"
      echo -en "\n$msg:start=$travis_start_time,finish=$travis_end_time,duration=$duration\r\033[0K"
    }
    if [ $(uname) = 'Darwin' ]; then
      travis_nanoseconds() {
        date -u '+%s000000000'
      }
    else
      travis_nanoseconds() {
        date -u '+%s%N'
      }
    fi
  else
    travis_fold() { return 0; }
    travis_time_start() { return 0; }
    travis_time_finish() { return 0; }
  fi
fi
```

## rust-lang/rust-central-station

### [crontab](https://github.com/rust-lang/rust-central-station/blob/497bfad57775c89b1651b4d3908445ea24ddee6d/crontab)
```
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.cargo/bin

# renewing ssl certs
24 * * * * root letsencrypt renew 2>&1 | logger --tag letsencrypt-renew

# signing/hashing/promoting releases
0 0 * * * root promote-release /tmp/nightly nightly /data/secrets.toml 2>&1 | logger --tag release-nightly
20 3 * * * root promote-release /tmp/beta beta /data/secrets.toml 2>&1 | logger --tag release-beta
40 * * * * root promote-release /tmp/stable stable /data/secrets-dev.toml 2>&1 | logger --tag release-stable

# cancelling appveyor/travis builds if we don't need them
*/2 * * * * root /src/bin/cancelbot-rust.sh 2>&1 | logger --tag cancelbot-rust
```

### [promote-release/src/main.rs](https://github.com/rust-lang/rust-central-station/blob/497bfad57775c89b1651b4d3908445ea24ddee6d/promote-release/src/main.rs)
```rust
extern crate curl;
extern crate flate2;
extern crate fs2;
extern crate rand;
#[macro_use]
extern crate serde_json;
extern crate tar;
extern crate toml;
extern crate xz2;

use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{PathBuf, Path};
use std::process::Command;

use curl::easy::Easy;
use fs2::FileExt;

macro_rules! t {
    ($e:expr) => (match $e {
        Ok(e) => e,
        Err(e) => panic!("{} failed with {:?}", stringify!($e), e),
    })
}

struct Context {
    work: PathBuf,
    release: String,
    handle: Easy,
	secrets: toml::Value,
    date: String,
    current_version: Option<String>,
}

// Called as:
//
//  $prog work/dir release-channel path/to/secrets.toml
fn main() {
    let mut secrets = String::new();
    t!(t!(File::open(env::args().nth(3).unwrap())).read_to_string(&mut secrets));

    Context {
        work: t!(env::current_dir()).join(env::args_os().nth(1).unwrap()),
        release: env::args().nth(2).unwrap(),
        secrets: t!(secrets.parse()),
        handle: Easy::new(),
        date: output(Command::new("date").arg("+%Y-%m-%d")).trim().to_string(),
        current_version: None,
    }.run()
}

impl Context {
    fn run(&mut self) {
        let _lock = self.lock();
        self.update_repo();
        let branch = match &self.release[..] {
            "nightly" => "master",
            "beta" => "beta",
            "stable" => "stable",
            _ => panic!("unknown release: {}", self.release),
        };
        self.do_release(branch);
    }

    /// Locks execution of concurrent invocations of this script in case one
    /// takes a long time to run. The call to `try_lock_exclusive` will fail if
    /// the lock is held already
    fn lock(&mut self) -> File {
        t!(fs::create_dir_all(&self.work));
        let file = t!(OpenOptions::new()
                            .read(true)
                            .write(true)
                            .create(true)
                            .open(self.work.join(".lock")));
        t!(file.try_lock_exclusive());
        file
    }

    /// Update the rust repository we have cached, either cloning a fresh one or
    /// fetching remote references
    fn update_repo(&mut self) {
        // Clone/update the repo
        let dir = self.rust_dir();
        if dir.is_dir() {
            println!("fetching");
            run(Command::new("git")
                        .arg("fetch")
                        .arg("origin")
                        .current_dir(&dir));
        } else {
            println!("cloning");
            run(Command::new("git")
                        .arg("clone")
                        .arg("https://github.com/rust-lang/rust")
                        .arg(&dir));
        }
    }

    /// Does a release for the `branch` specified.
    fn do_release(&mut self, branch: &str) {
        // Learn the precise rev of the remote branch, this'll guide what we
        // download.
        let rev = output(Command::new("git")
                                 .arg("rev-parse")
                                 .arg(format!("origin/{}", branch))
                                 .current_dir(&self.rust_dir()));
        let rev = rev.trim();
        println!("{} rev is {}", self.release, rev);

        // Download the current live manifest for the channel we're releasing.
        // Through that we learn the current version of the release.
        let manifest = self.download_manifest();
        let previous_version = manifest["pkg"]["rust"]["version"]
                                       .as_str()
                                       .expect("rust version not a string");
        println!("previous version: {}", previous_version);

        // If the previously released version is the same rev, then there's
        // nothing for us to do, nothing has changed.
        if previous_version.contains(&rev[..7]) {
            return println!("found rev in previous version, skipping");
        }

        // We may still not do a release if the version number hasn't changed.
        // To learn about the current branch's version number we download
        // artifacts and look inside.
        //
        // If revisions of the current release and the current branch are
        // different and the versions are the same then there's nothing for us
        // to do. This represents a scenario where changes have been merged to
        // the stable/beta branch but the version bump hasn't happened yet.
        self.download_artifacts(&rev);
        if self.current_version_same(&previous_version) {
            return println!("version hasn't changed, skipping");
        }

        self.assert_all_components_present();

        // Ok we've now determined that a release needs to be done. Let's
        // configure rust, sign the artifacts we just downloaded, and upload the
        // signatures to the CI bucket.
        self.configure_rust(rev);
        self.sign_artifacts();
        self.upload_signatures(&rev);

        // Merge all the signatures with the download files, and then sync that
        // whole dir up to the release archives
        for file in t!(self.build_dir().join("build/dist/").read_dir()) {
            let file = t!(file);
            t!(fs::copy(file.path(), self.dl_dir().join(file.file_name())));
        }
        self.publish_archive();
        self.publish_docs();
        self.publish_release();

        self.invalidate_cloudfront();
    }

    fn configure_rust(&mut self, rev: &str) {
        let build = self.build_dir();
        drop(fs::remove_dir_all(&build));
        t!(fs::create_dir_all(&build));
        let rust = self.rust_dir();

        run(Command::new("git")
                    .arg("reset")
                    .arg("--hard")
                    .arg(rev)
                    .current_dir(&rust));

        run(Command::new(rust.join("configure"))
                    .current_dir(&build)
                    .arg(format!("--release-channel={}", self.release)));
        let mut config = String::new();
        let path = build.join("config.toml");
        drop(File::open(&path).and_then(|mut f| f.read_to_string(&mut config)));
        let lines = config.lines().filter(|l| !l.starts_with("[dist]"));
        let mut new_config = String::new();
        for line in lines {
            new_config.push_str(line);
            new_config.push_str("\n");
        }
        new_config.push_str(&format!("
[dist]
sign-folder = \"{}\"
gpg-password-file = \"{}\"
upload-addr = \"{}/{}\"
",
            self.dl_dir().display(),
            self.secrets["dist"]["gpg-password-file"].as_str().unwrap(),
            self.secrets["dist"]["upload-addr"].as_str().unwrap(),
            self.secrets["dist"]["upload-dir"].as_str().unwrap()));
        t!(t!(File::create(&path)).write_all(new_config.as_bytes()));
    }

    fn current_version_same(&mut self, prev: &str) -> bool {
        // nightly's always changing
        if self.release == "nightly" {
            return false
        }
        let prev_version = prev.split(' ').next().unwrap();

        let current = t!(self.dl_dir().read_dir()).filter_map(|e| {
            let e = t!(e);
            let filename = e.file_name().into_string().unwrap();
            if !filename.starts_with("rustc-") || !filename.ends_with(".tar.gz") {
                return None
            }
            println!("looking inside {} for a version", filename);

            let file = t!(File::open(&e.path()));
            let reader = flate2::read::GzDecoder::new(file);
            let mut archive = tar::Archive::new(reader);

            let entry = t!(archive.entries()).map(|e| t!(e)).filter(|e| {
                let path = t!(e.path());
                match path.iter().skip(1).next() {
                    Some(path) => path == Path::new("version"),
                    None => false,
                }
            }).next();
            let mut entry = match entry {
                Some(e) => e,
                None => return None,
            };
            let mut contents = String::new();
            t!(entry.read_to_string(&mut contents));
            Some(contents)
        }).next().expect("no archives with a version");

        println!("current version: {}", current);

        let current_version = current.split(' ').next().unwrap();
        self.current_version = Some(current_version.to_string());

        // The release process for beta looks like so:
        //
        // * Force push master branch to beta branch
        // * Send a PR to beta, updating release channel
        //
        // In the window between these two steps we don't actually have release
        // artifacts but this script may be run. Try to detect that case here if
        // the versions mismatch and panic. We'll try again later once that PR
        // has merged and everything should look good.
        if (current.contains("nightly") && !prev.contains("nightly")) ||
           (current.contains("beta") && !prev.contains("beta")) {
            panic!("looks like channels are being switched -- was this branch \
                    just created and has a pending PR to change the release \
                    channel?");
        }

        prev_version == current_version
    }

    /// An emergency fix for the current situation where the RLS or clippy often
    /// aren't available. Don't produce nightlies if a component is missing.
    ///
    /// Note that we already don't merge PRs in rust-lang/rust that don't
    /// build cargo
    fn assert_all_components_present(&self) {
        if self.release != "nightly" {
            return
        }
        let components = t!(self.dl_dir().read_dir())
            .map(|e| t!(e))
            .map(|e| e.file_name().into_string().unwrap())
            .filter(|s| s.contains("x86_64-unknown-linux-gnu"))
            .collect::<Vec<_>>();
        println!("components in this nightly {:?}", components);
        assert!(components.iter().any(|s| s.starts_with("rustc-")));
        assert!(components.iter().any(|s| s.starts_with("rust-std-")));
        assert!(components.iter().any(|s| s.starts_with("cargo-")));
        // assert!(components.iter().any(|s| s.starts_with("rustfmt-")));
        // assert!(components.iter().any(|s| s.starts_with("rls-")));
        // assert!(components.iter().any(|s| s.starts_with("clippy-")));
    }

    fn download_artifacts(&mut self, rev: &str) {
        let dl = self.dl_dir();
        drop(fs::remove_dir_all(&dl));
        t!(fs::create_dir_all(&dl));

        let src = format!("s3://rust-lang-ci2/rustc-builds/{}/", rev);
        run(self.aws_s3()
                .arg("cp")
                .arg("--recursive")
                .arg("--only-show-errors")
                .arg(&src)
                .arg(format!("{}/", dl.display())));

        let mut files = t!(dl.read_dir());
        if files.next().is_none() {
            panic!("appears that this rev doesn't have any artifacts, \
                    is this a stable/beta branch awaiting a PR?");
        }

        // Delete residue signature/hash files. These may come around for a few
        // reasons:
        //
        // 1. We died halfway through before uploading the manifest, in which
        //    case we want to re-upload everything but we don't want to sign
        //    signatures.
        //
        // 2. We're making a stable release. The stable release is first signed
        //    with the dev key and then it's signed with the prod key later. We
        //    want the prod key to overwrite the dev key signatures.
        //
        // Also, generate *.gz from *.xz if the former is missing. Since the gz
        // and xz tarballs have the same content, we did not deploy the gz files
        // from the CI. But rustup users may still expect to get gz files, so we
        // are recompressing the xz files as gz here.
        for file in t!(dl.read_dir()) {
            let file = t!(file);
            let path = file.path();
            match path.extension().and_then(|s| s.to_str()) {
                // Delete signature/hash files...
                Some("asc") |
                Some("sha256") => {
                    t!(fs::remove_file(&path));
                }
                // Generate *.gz from *.xz...
                Some("xz") => {
                    let gz_path = path.with_extension("gz");
                    if !gz_path.is_file() {
                        println!("recompressing {}...", gz_path.display());
                        let xz = t!(File::open(path));
                        let mut xz = xz2::read::XzDecoder::new(xz);
                        let gz = t!(File::create(gz_path));
                        let mut gz = flate2::write::GzEncoder::new(gz, flate2::Compression::best());
                        t!(io::copy(&mut xz, &mut gz));
                    }
                }
                _ => {}
            }
        }
    }

    fn sign_artifacts(&mut self) {
        let build = self.build_dir();
        run(Command::new(self.rust_dir().join("x.py"))
                    .current_dir(&build)
                    .arg("dist")
                    .arg("hash-and-sign"));
    }

    fn upload_signatures(&mut self, rev: &str) {
        let dst = format!("s3://rust-lang-ci2/rustc-builds/{}/", rev);
        run(self.aws_s3()
                .arg("cp")
                .arg("--recursive")
                .arg("--only-show-errors")
                .arg(self.build_dir().join("build/dist/"))
                .arg(&dst));
    }

    fn publish_archive(&mut self) {
        let bucket = self.secrets["dist"]["upload-bucket"].as_str().unwrap();
        let dir = self.secrets["dist"]["upload-dir"].as_str().unwrap();
        let dst = format!("s3://{}/{}/{}/", bucket, dir, self.date);
        run(self.aws_s3()
                .arg("cp")
                .arg("--recursive")
                .arg("--only-show-errors")
                .arg("--metadata-directive")
                .arg("REPLACE")
                .arg("--cache-control")
                .arg("public")
                .arg(format!("{}/", self.dl_dir().display()))
                .arg(&dst));
    }

    fn publish_docs(&mut self) {
        let (version, upload_dir) = match &self.release[..] {
            "stable" => {
                let vers = &self.current_version.as_ref().unwrap()[..];
                (vers, "stable")
            }
            "beta" => ("beta", "beta"),
            "nightly" => ("nightly", "nightly"),
            _ => panic!(),
        };

        // Pull out HTML documentation from one of the `rust-docs-*` tarballs.
        // For now we just arbitrarily pick x86_64-unknown-linux-gnu.
        let docs = self.work.join("docs");
        drop(fs::remove_dir_all(&docs));
        t!(fs::create_dir_all(&docs));
        let target = "x86_64-unknown-linux-gnu";

        // Unpack the regular documentation tarball.
        let tarball_prefix = format!("rust-docs-{}-{}", version, target);
        let tarball = format!("{}.tar.gz", self.dl_dir().join(&tarball_prefix).display());
        let tarball_dir = format!("{}/rust-docs/share/doc/rust/html", tarball_prefix);
        run(Command::new("tar")
                    .arg("xf")
                    .arg(&tarball)
                    .arg("--strip-components=6")
                    .arg(&tarball_dir)
                    .current_dir(&docs));

        // Construct path to rustc documentation.
        let tarball_prefix = format!("rustc-docs-{}-{}", version, target);
        let tarball = format!("{}.tar.gz", self.dl_dir().join(&tarball_prefix).display());
        // Construct the path that contains the documentation inside the tarball.
        let tarball_dir = format!("{}/rustc-docs/share/doc/rust/html", tarball_prefix);

        // Only create and unpack rustc docs if artefacts include tarball.
        if Path::new(&tarball).exists() {
            let rustc_docs = docs.join("nightly-rustc");
            t!(fs::create_dir_all(&rustc_docs));

            // Unpack the rustc documentation into the new directory.
            run(Command::new("tar")
                        .arg("xf")
                        .arg(&tarball)
                        .arg("--strip-components=6")
                        .arg(&tarball_dir)
                        .current_dir(&rustc_docs));
        }

        // Upload this to `/doc/$channel`
        let bucket = self.secrets["dist"]["upload-bucket"].as_str().unwrap();
        let dst = format!("s3://{}/doc/{}/", bucket, upload_dir);
        run(self.aws_s3()
                .arg("sync")
                .arg("--delete")
                .arg("--only-show-errors")
                .arg(format!("{}/", docs.display()))
                .arg(&dst));
        self.invalidate_docs(upload_dir);

        // Stable artifacts also go to `/doc/$version/
        if upload_dir == "stable" {
            let dst = format!("s3://{}/doc/{}/", bucket, version);
            run(self.aws_s3()
                    .arg("sync")
                    .arg("--delete")
                    .arg("--only-show-errors")
                    .arg(format!("{}/", docs.display()))
                    .arg(&dst));
            self.invalidate_docs(&version);
        }
    }

    fn invalidate_docs(&self, dir: &str) {
        let distribution_id = self.secrets["dist"]["rustdoc-cf-distribution-id"]
                                          .as_str().unwrap();
        let mut cmd = Command::new("aws");
        self.aws_creds(&mut cmd);
        cmd.arg("cloudfront")
            .arg("create-invalidation")
            .arg("--distribution-id").arg(distribution_id);
        if dir == "stable" {
            cmd.arg("--paths").arg("/*");
        } else {
            cmd.arg("--paths").arg(format!("/{0}/*", dir));
        }
        run(&mut cmd);
    }

    fn publish_release(&mut self) {
        let bucket = self.secrets["dist"]["upload-bucket"].as_str().unwrap();
        let dir = self.secrets["dist"]["upload-dir"].as_str().unwrap();
        let dst = format!("s3://{}/{}/", bucket, dir);
        run(self.aws_s3()
                .arg("cp")
                .arg("--recursive")
                .arg("--only-show-errors")
                .arg(format!("{}/", self.dl_dir().display()))
                .arg(&dst));
    }

    fn invalidate_cloudfront(&mut self) {
        let json = json!({
            "Paths": {
                "Items": [
                    "/dist/channel*",
                    "/dist/rust*",
                    "/dist/index*",
                    "/dist/",
                ],
                "Quantity": 4,
            },
            "CallerReference": format!("rct-{}", rand::random::<usize>()),
        }).to_string();
        let dst = self.work.join("payload.json");
        t!(t!(File::create(&dst)).write_all(json.as_bytes()));

        let distribution_id = self.secrets["dist"]["cloudfront-distribution-id"]
                                          .as_str().unwrap();
        let mut cmd = Command::new("aws");
        self.aws_creds(&mut cmd);
        run(cmd.arg("cloudfront")
               .arg("create-invalidation")
               .arg("--invalidation-batch").arg(format!("file://{}", dst.display()))
               .arg("--distribution-id").arg(distribution_id));
    }

    fn rust_dir(&self) -> PathBuf {
        self.work.join("rust")
    }

    fn dl_dir(&self) -> PathBuf {
        self.work.join("dl")
    }

    fn build_dir(&self) -> PathBuf {
        self.work.join("build")
    }

    fn aws_s3(&self) -> Command {
        let mut cmd = Command::new("aws");
        cmd.arg("s3");
        self.aws_creds(&mut cmd);
        return cmd
    }

    fn aws_creds(&self, cmd: &mut Command) {
        let access = self.secrets["dist"]["aws-access-key-id"].as_str().unwrap();
        let secret = self.secrets["dist"]["aws-secret-key"].as_str().unwrap();
        cmd.env("AWS_ACCESS_KEY_ID", &access)
           .env("AWS_SECRET_ACCESS_KEY", &secret);
    }

    fn download_manifest(&mut self) -> toml::Value {
        t!(self.handle.get(true));
        let addr = self.secrets["dist"]["upload-addr"].as_str().unwrap();
        let upload_dir = self.secrets["dist"]["upload-dir"].as_str().unwrap();
        let url = format!("{}/{}/channel-rust-{}.toml",
                          addr,
                          upload_dir,
                          self.release);
        println!("downloading manifest from: {}", url);
        t!(self.handle.url(&url));
        let mut result = Vec::new();
        {
            let mut t = self.handle.transfer();

            t!(t.write_function(|data| {
                result.extend_from_slice(data);
                Ok(data.len())
            }));
            t!(t.perform());
        }
        assert_eq!(t!(self.handle.response_code()), 200);
        t!(t!(String::from_utf8(result)).parse())
    }
}

fn run(cmd: &mut Command) {
    println!("running {:?}", cmd);
    let status = t!(cmd.status());
    if !status.success() {
        panic!("failed command:{:?}\n:{}", cmd, status);
    }
}

fn output(cmd: &mut Command) -> String {
    println!("running {:?}", cmd);
    let output = t!(cmd.output());
    if !output.status.success() {
        panic!("failed command:{:?}\n:{}\n\n{}\n\n{}", cmd, output.status,
               String::from_utf8_lossy(&output.stdout),
               String::from_utf8_lossy(&output.stderr),);
    }

    String::from_utf8(output.stdout).unwrap()
}
```

## rust-lang-nursery/tool-state
## rust-lang/rustup.rs
